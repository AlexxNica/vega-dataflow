var tape = require('tape'),
    dataflow = require('../../');

tape('Crossfilter filters tuples', function(test) {
  var data = [
    {a: 1, b: 1, c:0}, {a: 2, b: 2, c:1},
    {a: 4, b: 4, c:2}, {a: 3, b: 3, c:3}
  ].map(dataflow.Tuple.ingest);

  var a = dataflow.field('a'),
      b = dataflow.field('b'),
      df = new dataflow.Dataflow(),
      r1 = df.add([0, 5]),
      r2 = df.add([0, 5]),
      cf = df.add(dataflow.CrossFilter, {fields:[a,b], query:[r1,r2]}),
      f1 = df.add(dataflow.ResolveFilter, {ignore:2, filter:cf}),
      o1 = df.add(dataflow.Collect, {pulse: f1}),
      f2 = df.add(dataflow.ResolveFilter, {ignore:1, filter:cf}),
      o2 = df.add(dataflow.Collect, {pulse: f2}),
      fn = df.add(dataflow.ResolveFilter, {ignore:0, filter:cf}),
      on = df.add(dataflow.Collect, {pulse: fn});

  // -- add data
  df.nextPulse.add = data;
  df.run();
  test.equal(o1.value.length, 4);
  test.equal(o2.value.length, 4);
  test.equal(on.value.length, 4);

  // -- update single query
  df.update(r2, [1,2]).run();
  test.equal(o1.value.length, 4);
  test.equal(o2.value.length, 2);
  test.equal(on.value.length, 2);

  // -- update multiple queries
  df.update(r1, [1,3])
    .update(r2, [3,4])
    .run();
  test.equal(o1.value.length, 3);
  test.equal(o2.value.length, 2);
  test.equal(on.value.length, 1);

  // -- remove data
  df.nextPulse.rem = data.slice(0, 2);
  df.touch(cf).run();
  test.equal(o1.value.length, 1);
  test.equal(o2.value.length, 2);
  test.equal(on.value.length, 1);

  // -- remove more data
  df.nextPulse.rem = data.slice(-2);
  df.touch(cf).run();
  test.equal(o1.value.length, 0);
  test.equal(o2.value.length, 0);
  test.equal(on.value.length, 0);

  // -- add data back
  df.nextPulse.add = data;
  df.touch(cf).run();
  test.equal(o1.value.length, 3);
  test.equal(o2.value.length, 2);
  test.equal(on.value.length, 1);

  // -- modify non-indexed values
  data[0].c = 5;
  data[3].c = 5;
  df.nextPulse.mod = [data[0], data[3]];
  df.nextPulse.modifies('c');
  df.touch(cf).run();
  test.equal(o1.value.length, 3);
  test.equal(o2.value.length, 2);
  test.equal(on.value.length, 1);
  test.equal(o1.pulse.materialize().mod.length, 2);
  test.equal(o2.pulse.materialize().mod.length, 1);
  test.equal(on.pulse.materialize().mod.length, 1);

  test.end();
});

tape('Crossfilter consolidates after remove', function(test) {
  var data = [
    {a: 1, b: 1, c:0}, {a: 2, b: 2, c:1},
    {a: 4, b: 4, c:2}, {a: 3, b: 3, c:3}
  ].map(dataflow.Tuple.ingest);

  var a = dataflow.field('a'),
      b = dataflow.field('b'),
      df = new dataflow.Dataflow(),
      r1 = df.add([0, 3]),
      r2 = df.add([0, 3]),
      cf = df.add(dataflow.CrossFilter, {fields:[a,b], query:[r1,r2]});

  // -- add data
  df.nextPulse.add = data;
  df.run();

  // -- remove data
  df.nextPulse.rem = data.slice(0, 2);
  df.touch(cf).run();

  // crossfilter consolidates after removal
  // this happens *after* propagation completes

  // were indices appropriately remapped?
  cf.index.map(function(index) {
    var idx = index.index();
    test.equal(index.size(), 2);
    test.equal(idx[0], 1);
    test.equal(idx[1], 0);
  });

  // was the filter state appropriately updated?
  var d = cf.value.data(),
      curr = cf.value.curr();
  test.equal(cf.value.size(), 2);
  test.equal(d[0], data[2]);
  test.equal(d[1], data[3]);
  test.equal(curr[0], (1 << 2) - 1); // first filter should fail all
  test.equal(curr[1], 0); // second filter should pass all

  test.end();
});
