const {createServer} = require('http');
const server = createServer((request, response) => {
    response.write('data')
    response.end()
    request.on('end')
    request.on()
});