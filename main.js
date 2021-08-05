const { tmi } = window;

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
    for (let i = 0; i < ca.length; i += 1) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
};

// Get parameters from url
const username = urlParams.get('botusername');
const oauth = urlParams.get('oauth');

const channel = (
    urlParams.get('channel') ||
    readCookie('twitch_channel') ||
    prompt(`Channel parameter is missing in URL (channel=xxxx)\n\nPlease enter the Twitch channel:`, 'twitch') ||
    'twitch'
).toLowerCase(); // If no channel is filled > use twitch as channel

// Check if default gif is valid url
const skipGifParam = urlParams.get('skip') || '';
const skipGif =
    skipGifParam.match(/https?:\/\/media\.giphy\.com\/media\/([A-z0-9]+)\/giphy\.gif/) ||
    skipGifParam.match(/https?:\/\/giphy\.com\/embed\/([A-z0-9]+)/)
        ? skipGifParam
        : `https://media.giphy.com/media/pTIaVha38QDA8EdSCJ/giphy.gif`;

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

// Set up variables
let banList = JSON.parse(readCookie('ban_list') || '[]'); // Create banlist
let currentMode = readCookie('gif_mode') || 'everyone'; // Set mode what is allowed (mods|subs|everyone)
let gifTimeout = false;
let gifDuration = isNaN(urlParams.get('duration')) ? 6 : Number(urlParams.get('duration'));

// Function to send tmi message if able torespond.
const sendTmiMessage = ({ message }) => {
    if (!tmiOptions.identity.username) return;

    client.say(channel, message);
};

// Function to add user to banlist
const addToBanList = ({ banUser, tusername }) => {
    if (banList.includes(banUser)) return sendTmiMessage({ message: `@${tusername}: ${banUser} is already banned!` });

    banList.push(banUser);
    document.cookie = `ban_list=${JSON.stringify(banList)}`;

    return sendTmiMessage({ message: `@${username}: ${banUser} is now banned from posting gifs!` });
};

// Function to add user to banlist
const removeFromBanList = ({ banUser, tusername }) => {
    if (!banList.includes(banUser)) return sendTmiMessage({ message: `@${tusername}: ${banUser} is not banned!` });

    banList = banList.filter((e) => e !== banUser);
    document.cookie = `ban_list=${JSON.stringify(banList)}`;

    return sendTmiMessage({ message: `@${username}: ${banUser} is unbanned!` });
};

// Function to set who is allowed to post gifs (mods|subs|everyone)
const setMode = ({ mode, tusername }) => {
    currentMode = mode;
    document.cookie = `gif_mode=${mode}`;

    return sendTmiMessage({ message: `@${tusername} ${currentMode} can post a gif` });
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

// Function to wait for image laod.
const imageLoaded = ({ src }) => {
    return new Promise((resolve) => {
        const image = new Image();
        image.src = src;

        image.addEventListener('load', () => {
            resolve(image.src);
        });
    });
};

// Get DOM elements
const leftGifEl = document.getElementById('gif_left');
const rightGifEl = document.getElementById('gif_right');
const usernameEl = document.getElementById('username');

// Function to set view mode (split|fullscreen)
const setGifViewMode = ({ mode }) => {
    leftGifEl.dataset.mode = mode;
    rightGifEl.dataset.mode = mode;
    document.cookie = `gif_view_mode=${mode}`;
};

// Set view mode from cookie
setGifViewMode({ mode: readCookie('gif_view_mode') || 'fullscreen' });

const modCommands = ['allow', 'split', 'fullscreen', 'skip', 'ban', 'unban', 'duration'];

// Function to handle commands from chat
const handleCommand = async ({ command, args, tags }) => {
    // Handle !gif with commands
    if (command !== 'gif') return;

    // Check for possible mod commands
    if (modCommands.includes(args[0].toLowerCase()) && (tags.mod || tags.username === channel)) {
        switch (args[0]) {
            // mod only commands
            case 'skip': {
                // Preload gif
                const imageSrc = await imageLoaded({ src: skipGif });

                // Set gif
                leftGifEl.style.backgroundImage = `url(${imageSrc})`;
                rightGifEl.style.backgroundImage = `url(${imageSrc})`;
                break;
            }

            case 'duration': {
                if (isNaN(args[1]) || args[1] <= 0) {
                    sendTmiMessage({ message: `@${tags.username} make sure to add a duration in seconds` });
                    break;
                }
                gifDuration = Number(args[1]);
                sendTmiMessage({ message: `@${tags.username} gif duration set to ${gifDuration} ${gifDuration === 1 ? 'second' : 'seconds'}` });
                break;
            }

            case 'allow':
                if (args[1] && !args[1].match(/\beveryone\b|\bsubs\b|\bmods\b/)) {
                    sendTmiMessage({ message: `@${tags.username} make sure to add valid group: !gif allow (everyone|subs|mods)` });
                    break;
                }
                setMode({ mode: args[1], tusername: tags.username });
                break;

            case 'split':
                setGifViewMode({ mode: 'split' });
                break;

            case 'fullscreen':
                setGifViewMode({ mode: 'fullscreen' });
                break;

            case 'ban':
                if (!args[1]) {
                    sendTmiMessage({ message: `@${tags.username} make sure to add the username` });
                    break;
                }
                addToBanList({ banUser: args[1].startsWith('@') ? args[1].slice(1) : args[1], tusername: tags.username });
                break;

            case 'unban':
                if (!args[1]) {
                    sendTmiMessage({ message: `@${tags.username} make sure to add the username` });
                    break;
                }
                removeFromBanList({ banUser: args[1].startsWith('@') ? args[1].slice(1) : args[1], tusername: tags.username });
                break;

            default: {
                break;
            }
        }
    } else {
        // If waiting for gif to end, return
        if (gifTimeout) return;

        // Check if !gif has any arguments
        if (!args[0]) {
            sendTmiMessage({ message: `@${tags.username} only gifs from giphy.com are allowed!` });
            return;
        }

        // Check if url matches
        const regexpResult =
            args[0].match(/https?:\/\/media\.giphy\.com\/media\/([A-z0-9]+)\/giphy\.gif/) ||
            args[0].match(/https?:\/\/giphy\.com\/embed\/([A-z0-9]+)/);

        // Response if url does not match
        if (!regexpResult) {
            sendTmiMessage({ message: `@${tags.username} only gifs from giphy.com are allowed!` });
            return;
        }

        // Is user allowed to post gif
        if (banList.includes(tags.username) || !isAllowed({ tags })) return;

        // Preload gif
        const imageSrc = await imageLoaded({ src: `https://media.giphy.com/media/${regexpResult[1]}/giphy.gif` });

        // Set timeout to next gif
        gifTimeout = true;
        window.setTimeout(() => {
            gifTimeout = false;
        }, gifDuration * 1000);

        // Set gif
        leftGifEl.style.backgroundImage = `url(${imageSrc})`;
        rightGifEl.style.backgroundImage = `url(${imageSrc})`;

        // Show and hide which user requested the Gif
        usernameEl.style.opacity = 0.5;
        usernameEl.innerHTML = tags['display-name'];

        window.setTimeout(() => {
            usernameEl.style.opacity = 0;
        }, 1700);
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
