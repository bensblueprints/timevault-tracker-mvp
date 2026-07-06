const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5316;
const app = createApp();

app.listen(PORT, () => {
  console.log('Timevault running');
  console.log(`  App : http://localhost:${PORT}/`);
});
