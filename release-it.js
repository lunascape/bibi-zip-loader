const package = require('./package.json');
const artifact = package.name + '-' + package.version;
const tagName = 'v' + package.version;

module.exports = {
    git: {
        commit: false,
        tag: false,
        requireUpstream: false,
        push: false,
        tagName
    },
    github: {
        release: true,
        releaseName: tagName,
        assets: [
          artifact + '.tgz',
        ],
        releaseNotes: `node -pe "require('fs').readFileSync('CHANGELOG.md', 'utf8').split(/(?:\\n)?\\d+\\.\\d+\\.\\d+(?:(?:-|\\+).*)?\\n-+\\n(?:\\n)?/g)[1]"`,
        tokenRef: 'PEGASUS_CI_GITHUB_TOKEN'
    },
    npm: false
};
