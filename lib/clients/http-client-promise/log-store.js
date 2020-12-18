// singleton of log items
const logStore = [];
// on exit display all debug messages
process.on('exit', () => {
    logStore.forEach(item => console.log(item));
});

module.exports = logStore;
