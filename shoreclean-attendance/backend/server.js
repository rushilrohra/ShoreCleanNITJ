const app = require('./src/app');
const { testConnection } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

testConnection();

app.listen(PORT, () => {
  console.log(`ShoreClean backend running on port ${PORT}`);
});
