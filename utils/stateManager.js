const fs = require('fs');
const filePath = './nukeState.json';

function loadNukeState() {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ nukingEnabled: false }));
    }
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
}

function saveNukeState(state) {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

module.exports = {
    loadNukeState,
    saveNukeState
};
