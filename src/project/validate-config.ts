type Check = (value: unknown, field: string) => void;

const expectValue =
  (test: (value: unknown) => boolean, expected: string): Check =>
  (value, field) => {
    if (!test(value)) throw new Error(`${field} must be ${expected}.`);
  };

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
};

const fields =
  (checks: Record<string, Check>, required: string[] = []): Check =>
  (value, field) => {
    const entries = record(value, field);
    for (const key of required) {
      if (!Object.hasOwn(entries, key)) throw new Error(`${field}.${key} is required.`);
    }
    for (const [key, child] of Object.entries(entries)) {
      if (!Object.hasOwn(checks, key)) throw new Error(`Unknown configuration key ${field}.${key}.`);
      checks[key](child, `${field}.${key}`);
    }
  };

const nonempty = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;
const nonnegative = expectValue(
  (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  'a finite, nonnegative number'
);
const positive = expectValue(
  (value) => typeof value === 'number' && Number.isFinite(value) && value > 0,
  'a finite, positive number'
);
const boolean = expectValue((value) => typeof value === 'boolean', 'a boolean');
const strings = expectValue((value) => Array.isArray(value) && value.every(nonempty), 'an array of nonempty strings');
const date = expectValue(
  (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
  'a date in YYYY-MM-DD format'
);
const rule = fields({ enabled: boolean, cost: nonnegative });

/** Validate the stored settings before applying defaults. */
export const validateConfig = fields({
  dailyRate: nonnegative,
  currency: expectValue(nonempty, 'a nonempty string'),
  hoursPerDay: positive,
  ruleSelectors: strings,
  sourceDirs: strings,
  severityCosts: fields({
    Critical: nonnegative,
    High: nonnegative,
    Moderate: nonnegative,
    Low: nonnegative,
    Info: nonnegative,
  }),
  rules: (value, field) => {
    for (const [id, setting] of Object.entries(record(value, field))) rule(setting, `${field}.${id}`);
  },
  goal: fields({ debt: nonnegative, date }, ['debt', 'date']),
  game: fields({
    leaderboard: expectValue((value) => value === 'named' || value === 'team', '"named" or "team"'),
    rewardDeletedFiles: boolean,
  }),
  verifier: fields({
    runs: expectValue(
      (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
      'a positive integer'
    ),
    // Legacy configs may still contain this key. The verifier reads its command from the environment.
    command: expectValue((value) => typeof value === 'string', 'a string'),
  }),
});
