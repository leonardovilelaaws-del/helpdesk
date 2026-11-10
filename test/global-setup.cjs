const { prepareTestDatabase } = require('../scripts/setup-test-db.cjs');

module.exports = async () => {
  await prepareTestDatabase({ seed: true });
};
