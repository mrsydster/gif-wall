const { alert, tmi } = window;

const urlParams = new URLSearchParams(window.location.search);

// Check if URL contains clearcookies -> clear all cookies if true
if (urlParams.get('clearcookies') !== null && confirm('Are you sure to delete cookies from Gif Shower and so all its data?')) {
    document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
}

// Function to read value of specific cookie
const readCookie = (name) => {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
};

// Get parameters from url
const username = urlParams.get('botusername'); // streamdoctorsbot
const oauth = urlParams.get('oauth'); // oauth:ncrzdqqnzaau9wyefofjzh0xtai7i1

const channel = (
    urlParams.get('channel') ||
    readCookie('twitch_channel') ||
    prompt(`Channel parameter is missing in URL (channel=xxxx)\n\nPlease enter the Twitch channel:`, 'twitch') ||
    'twitch'
).toLowerCase(); // If no channel is filled > use twitch as channel

// Set the channel cookie
if (channel !== 'twitch') document.cookie = `twitch_channel=${channel}`;

// Tmi.js options
const tmiOptions = {
    options: { debug: urlParams.get('debug') !== null },
    identity: {
        username,
        password: `oauth:${oauth}`,
    },
    channels: [channel],
};

// Check if username or oauth is missing.
if (!username || !oauth) {
    if (readCookie('missing_oauth_message_shown') !== 'true') {
        alert(`Missing oauth parameters in URL (botusername=xxxx&oauth=xxxx)\n\nBot will not respond in chat!`);
        document.cookie = `missing_oauth_message_shown=true`;
    }

    // Delete the identity so bot will only read chat
    delete tmiOptions.identity;
}

// Create tmi client
const client = new tmi.Client(tmiOptions);

// Create banlist
let banList = JSON.parse(readCookie('ban_list') || '[]');
let currentMode = readCookie('gif_mode') || 'everyone'; // Set mode what is allowed (mods|subs|everyone)

// Function to send tmi message if able torespond.
const sendTmiMessage = ({ channel, message }) => {
    if (!tmiOptions.identity.username) return;

    client.say(channel, message);
};

// Function to add user to banlist
const addToBanList = ({ banUser, username }) => {
    if (banList.includes(banUser)) return sendTmiMessage({ channel, message: `@${username}: ${banUser} is already banned!` });

    banList.push(banUser);
    document.cookie = `ban_list=${JSON.stringify(banList)}`;

    return sendTmiMessage({ channel, message: `@${username}: ${banUser} is now banned from posting gifs!` });
};

// Function to add user to banlist
const removeFromBanList = ({ banUser, username }) => {
    if (!banList.includes(banUser)) return sendTmiMessage({ channel, message: `@${username}: ${banUser} is not banned!` });

    banList = banList.filter((e) => e !== banUser);
    document.cookie = `ban_list=${JSON.stringify(banList)}`;

    return sendTmiMessage({ channel, message: `@${username}: ${banUser} is unbanned!` });
};

const setMode = ({ mode, username }) => {
    currentMode = mode;
    document.cookie = `gif_mode=${mode}`;

    return sendTmiMessage({ channel, message: `@${username} ${currentMode} can post a gif` });
};

// Function to check if user is currently allowed to post a gif depending on the mode (mods|subs|everyone)
const isAllowed = ({ tags }) => {
    switch (currentMode) {
        case 'everyone':
            return true;

        case 'subs':
            return tags.username === channel || tags.subscriber || tags.mod || tags.badges.vip === '1';

        case 'mods':
            return tags.username === channel || tags.mod;

        default:
            return false;
    }
};

// Function to handle commands from chat
const handleCommand = ({ command, args, tags }) => {
    // Handle !gif with commands
    if (command === 'gif') {
        switch (args[0].toLowerCase()) {
            // mod only commands
            case 'allow':
                if (!(tags.mod || tags.username === channel)) break;
                else if (!args[1]?.match(/\beveryone\b|\bsubs\b|\bmods\b/))
                    return sendTmiMessage({ channel, message: `@${tags.username} make sure to add valid group: !gif allow (everyone|subs|mods)` });
                return setMode({ mode: args[1], username: tags.username });

            case 'ban':
                if (!(tags.mod || tags.username === channel)) break;
                else if (!args[1]) return sendTmiMessage({ channel, message: `@${tags.username} make sure to add the username` });
                return addToBanList({ banUser: args[1].startsWith('@') ? args[1].slice(1) : args[1], username: tags.username });

            case 'unban':
                if (!(tags.mod || tags.username === channel)) break;
                else if (!args[1]) return sendTmiMessage({ channel, message: `@${tags.username} make sure to add the username` });
                return removeFromBanList({ banUser: args[1].startsWith('@') ? args[1].slice(1) : args[1], username: tags.username });

            default:
                const regexpResult =
                    args[0]?.match(/https?:\/\/media\.giphy\.com\/media\/([A-z0-9]+)\/giphy\.gif/) ||
                    args[0]?.match(/https?:\/\/giphy\.com\/embed\/([A-z0-9]+)/);

                if (!regexpResult) return sendTmiMessage({ channel, message: `@${tags.username} only gifs from giphy.com are allowed!` });

                if (banList.includes(tags.username) || !isAllowed({ tags })) break;

                document.getElementById('gif').src = `https://media.giphy.com/media/${regexpResult[1]}/giphy.gif`;
                //media.giphy.com/media/heVkiIl8Wx3r5rwIQ6/giphy.gif
                https: break;
        }
    }
};

// Catch message
client.on('message', (_, tags, message, self) => {
    // Ignore echoed messages.
    if (self || !message.startsWith('!')) return;

    const args = message.slice(1).split(' ');
    const command = args.shift().toLowerCase();

    // Return if command is null or undefined
    if (!command) return;

    // Handle command
    handleCommand({ command, args, tags });
});

// Connect to tmi
client.connect();

document.getElementById('channel').innerHTML = channel;

// Todo:

// make gifs fullscreen and split with right mirrored
// add command to control fullscreen or split
// add fade between gifs
// show name in right bottom corner
// make url paramenter for length of gifs
// add either a queue or a timeout system for when next gif can be showed.
// add default gif an skip commmand so that mods can skip the command