// Values computed from the raw sources and the parsing settings. The raw text is kept in the
// state, so changing the parsing settings re-parses every file (IMP-4).
import { parseStatement } from '../../core/parser.js';
import { errorsIn } from './config-edit.js';

const empty = name => ({
  file: name,
  transactions: [],
  opening: null,
  closing: null,
  warnings: [],
  errors: [],
});

export function createDerive() {
  let last = { sources: null, parseKey: '', files: [] };

  return state => {
    const parseKey = JSON.stringify(state.config.parse);
    if (state.sources !== last.sources || parseKey !== last.parseKey) {
      const usable = errorsIn(state.config, 'parse').length === 0;
      last = {
        sources: state.sources,
        parseKey,
        files: state.sources.map(s =>
          usable ? parseStatement(s.text, state.config.parse, s.name) : empty(s.name),
        ),
      };
    }
    return { ...state, files: last.files };
  };
}
