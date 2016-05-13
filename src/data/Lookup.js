import Transform from './Transform';
import {inherits} from '../util/Functions';

/**
 * Compute rank order scores for tuples. The tuples are assumed to have been
 * sorted in the desired rank orderby an upstream data source.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {object} params.index - The lookup table.
 * @param {Array<function(object): *} params.keys - The lookup keys.
 * @param {Array<string>} params.fields - The per-key output fields to write.
 * @param {*} [params.default] - A default value to use if lookup failes.
 */
export default function Lookup(params) {
  Transform.call(this, {}, params);
}

var prototype = inherits(Lookup, Transform);

prototype.transform = function(_, pulse) {
  var fields = _.fields,
      index = _.index,
      keys = _.keys,
      defaultValue = _.default==null ? null : _.default,
      reset = _.modified('index'),
      flag = pulse.ADD,
      set, key, field, mods;

  if (keys.length === 1) {
    key = keys[0];
    field = fields[0];
    set = function(t) {
      var v = index[key(t)];
      t[field] = v==null ? defaultValue : v;
    };
  } else {
    set = function(t) {
      for (var i=0, n=keys.length, v; i<n; ++i) {
        v = index[keys[i](t)];
        t[fields[i]] = v==null ? defaultValue : v;
      }
    };
  }

  if (reset) {
    flag = pulse.SOURCE;
  } else {
    mods = keys.some(function(k) { return pulse.modified(k.fields); });
    flag = pulse.ADD |  (mods ? pulse.MOD : 0);
  }
  pulse.visit(flag, set);

  return pulse.modifies(fields);
};