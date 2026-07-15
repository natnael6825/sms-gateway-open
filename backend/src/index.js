const app = require('./app');
const bootstrapAdmin = require('./services/bootstrapAdmin');
const {
  expireStaleDispatchedMessages,
  startDispatchTimeoutSweeper,
} = require('./services/dispatchTimeoutSweeper');

const PORT = Number(process.env.PORT) || 6700;

bootstrapAdmin()
  .then(async () => {
    await expireStaleDispatchedMessages();
    startDispatchTimeoutSweeper({ runImmediately: false });
    app.listen(PORT, () => console.log(`SMS Gateway backend listening on port ${PORT}`));
  })
  .catch((error) => { console.error(`Startup failed: ${error.message}`); process.exit(1); });
