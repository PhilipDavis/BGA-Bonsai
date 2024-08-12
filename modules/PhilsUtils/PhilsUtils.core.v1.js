// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([], () => {
    const config = {
        gameName: '', // Leave this blank. Value assigned in install() method.
        gameRootId: '', // The element ID of the root game DOM tree. This gets mounted into #game_play_area
    };
    const data = {
        nextUniqueId: 1, // Used by stringFromTemplate when replacing ${_UNIQUEID}
        uninstallers: [], // Functions to undo any changes we make to core stuff
        reportedErrors: {}, // Collection of errors we've reported -- to avoid sending duplicates 
    };

    //
    // Install functions into the gameui and dojo contexts.
    // Recommended to be called at the beginning of the setup()
    // method. Will not work if called in the game constructor!
    //
    // setup() {
    //     install(dojo, this, 'abc_body'); // or install(dojo, this, 'abc_body', { debug: true });
    //
    //     // ...setup your game
    // }
    //
    function install(dojo, gameui, gameRootId, options = null) {
        const {
            debug = false,
        } = options || {};

        // Save the game name for use later (invoking server actions)
        config.gameName = gameui.game_name;
        config.gameRootId = gameRootId;

        // Define a variable to keep track of what move the client
        // sent to the server most recently. This is useful for
        // cases where a player has the game open in more than one
        // window -- it allows the other instances to catch up via
        // game notifications because they'll know they're behind.
        gameui.lastMoveSent = 0;
      
        //
        // dojo.string.substitute
        //
        const _substitute = dojo.string.substitute;
        data.uninstallers.push(() => dojo.string.substitute = _substitute);
        dojo.string.substitute = function() {
            try {
                const [ template, replacements ] = arguments;
                return stringFromTemplate(template, replacements, debug);
            }
            catch (err) {
                if (err.message === "USE_BGA") {
                    return _substitute.apply(dojo.string, arguments);
                }
                throw err;
            }
        };

        //
        // format_block
        //
        const _format_block = gameui.__proto__.format_block;
        data.uninstallers.push(() => gameui.__proto__.format_block = _format_block);
        gameui.__proto__.format_block = (templateName, replacements) => {
            return formatBlock(templateName, replacements, debug);
        };

        //
        // format_string_recursive
        //
        const _fsr = gameui.__proto__.format_string_recursive;
        data.uninstallers.push(() => gameui.__proto__.format_string_recursive = _fsr);
        gameui.__proto__.format_string_recursive = function() {
            // Note: mine does not perform recursion!!

            const [ template, args ] = arguments;
            try {
                return stringFromTemplate(template, args, debug);
            }
            catch (err) {
                if (err.message === "USE_BGA") {
                    return _fsr.apply(gameui, arguments);
                }
                throw err;
            }
        };

        //
        // Send JavaScript errors caused by the game to a special
        // game action (the states.inc.php file must allow an
        // action called 'jsError' in all states). Continue to
        // send other errors to the default BGA error reporter.
        //
        let __errorAllowance = 3;
        window.addEventListener('error', e => {
            if (__errorAllowance-- < 1) return;
            try {
                const { error, message, filename, lineno, colno } = e;
                const stack = (typeof error == 'object' && (error.stack || error.stacktrace)) || 'no stack';
                const payload = `${message}\n${filename}:${lineno}:${colno}\n${stack}`;
                gameui.onScriptError(payload, e.filename, `${lineno}:${colno}`);
            }
            catch (err) {
                console.error('Error occurred while submitting an error', err);
            }
        });
        const _ose = gameui.onScriptError;
        data.uninstallers.push(() => gameui.onScriptError = _ose);
        gameui.onScriptError = async function onScriptError(msg, url, lineNumber) {
            if (gameui.page_is_unloading) return;
            if (data.processingScriptError) return false;
            try {
                // Prevent reentry
                data.processingScriptError = true;

                // Send game errors to the game
                if ((msg + url).indexOf(`/${config.gameName}/`) >= 0) {
                    // Don't send duplicate reports in the same game
                    const hash = md5(`${msg}_${url}_${lineNumber}`);
                    if (data.reportedErrors[hash]) return;
                    data.reportedErrors[hash] = true;

                    const args = {
                        ua: navigator.userAgent,
                        url,
                        line: lineNumber,
                        // Note: the error handler installed by BGA
                        // ignores the column number... and I was unable
                        // to get in front of it.
                        msg,
                    };

                    console.error('Reporting error:', msg);

                    // Game must have an action called 'jsError' and must be available
                    // in all game states. Note: errors during setup() will not have
                    // a URL or line number due to the way BGA wrote their code.
                    await new Promise(resolve => {
                        gameui.ajaxcall(
                            `${config.gameName}/${config.gameName}/jsError.html`,
                            { lock: true, ...args },
                            () => {},
                            resolve,
                            undefined,
                            'post'
                        );
                    });
                    return;
                }

                // Defer all other errors to BGA default error capture
                _ose.call(gameui, msg, url, lineNumber);
            }
            finally {
                data.processingScriptError = false;
            }
        }

        //
        // Add convenience properties
        //
        Object.defineProperties(gameui, {
            currentState: {
                get() {
                    return this.gamedatas.gamestate.name;
                },
            },
            myPlayerId: {
                get() {
                    return this.player_id;
                },
            },
        });

        //
        // Register for preference changes
        //
        initPreferencesObserver();

        //
        // Register the AJAX notification handlers
        //
        setupNotifications();

        //
        // Add an observer to watch for DOM changes and undo
        // the changes we make to core BGA / Dojo stuff when
        // the game is unmounted
        //
        (() => {
            const bgaContainer = document.getElementById('game_play_area');

            new MutationObserver((mutationList, observer) => {
                for (const mutation of mutationList) {
                    if (mutation.type !== 'childList') continue;
                    if (config.gameRootId && !bgaContainer.querySelector(`& > #${config.gameRootId}`)) {
                        observer.disconnect();
                        while (data.uninstallers.length) {
                            try {
                                const uninstall = data.uninstallers.shift();
                                uninstall();
                            }
                            catch (err) {
                                console.error(err);
                            }
                        }
                    }
                }
            }).observe(bgaContainer, { childList: true });
        })();
    }

    //
    // Replacement for dojo.string.substitute 
    //
    function stringFromTemplate(template, replacements, strict = false) {
        if (template === null || template === undefined) {
            if (strict) {
                throw new Error('Empty template');
            }
            return '';
        }

        template = gameui.clienttranslate_string(template);

        // TODO: this part is less generic... maybe make the template name resolution more flexible?
        if (typeof replacements === 'object' && replacements.constructor.name === 'Object') {
            // Perform translation
            const { i18n } = replacements;
            if (typeof i18n == 'object') {
                for (const key of i18n) {
                    let enText = replacements[key];
                    if (strict && typeof enText == 'undefined') {
                        throw new Error(`Missing key '${key}' in ${JSON.stringify(Object.keys(replacements))} for template ${template}`);
                    }
                    else if (enText && typeof enText == 'object') {
                        const { log, args } = enText;
                        if (!log || !args) {
                            throw new Error(`Unexpected object '${key}' in replacement values for template ${template}`);
                        }
                        enText = stringFromTemplate(log, args, strict);
                    }
                    replacements[key] = enText ? gameui.clienttranslate_string(enText) : '';
                }
            }

            // Template replacement
            for (const [ key, value ] of Object.entries(replacements)) {
                const logMatch = /^_(?<dataKey>\D+)(?<index>\d*)$/.exec(key);
                if (logMatch) {
                    // This key/value pair is strictly for the replay logs, which don't have access
                    // to the images, CSS, nor JavaScript of the game page. We want to replace them
                    // with rich content for the in-game log.  Strip the leading underscore to find
                    // the name of the data key (which must have been sent from server side) and we
                    // replace the old key with the rich content.
                    const { dataKey, index } = logMatch.groups;
                    const dataValue = replacements[`${dataKey}${index}`];
                    if (dataValue !== undefined) {
                        if (typeof dataValue === 'object' && typeof dataValue.length === 'number') {
                            replacements[key] = dataValue.reduce((html, d) => html + formatBlock(`${config.gameName}_Templates.${dataKey}Log`, {
                                DATA: d.toString(),
                                INDEX: index,
                                TEXT: value.toString(),
                            }), '');
                        }
                        else {
                            replacements[key] = formatBlock(`${config.gameName}_Templates.${dataKey}Log`, {
                                DATA: dataValue.toString(),
                                INDEX: index,
                                TEXT: value.toString(),
                            });
                        }
                    }
                }
            }
        }

        //
        // Note: this regex is not 100% perfect... it watches* for an escaped
        // '$' character but it's possible to break the expected behaviour
        // with input like "Hello $$${WORLD}" -- in this case, no replacement
        // happens even though it should. I figure this will never happen in
        // a real-world scenario.
        //
        // *Note: Safari 15.6 doesn't support the negative look behind
        //   /(?<!\$)\$\{(?<name>.*?)(?:\[(?<index>.+?)\])?\}/g
        // So, I changed the regex to not look for escaped $ symbols.
        // This still shouldn't be a problem for use in BGA games.
        //
        return template.replace(/\$\{(?<name>.*?)(?:\[(?<index>.+?)\])?\}/g, (match, name, index) => {
            if (name === '_UNIQUEID') {
                replacements[name] = `${config.gameName}_uniqueid-${data.nextUniqueId++}`;
            }

            let value = replacements[name];
            if (typeof value === 'function') {
                value = value(index);
            }
            if (name === 'playerName') {
                const player = Object.values(gameui.gamedatas.players).find(p => p.name === value);
                if (player?.color.match(/[0-9a-f]{3,6}/)) {
                    value = `<b style="color: #${player.color};">${value}</b>`;
                }
            }
            if (value === undefined) {
                // I saw an error where the replacement name was "!actionBarTemplate" so
                // it looks like BGA has their own special names for things. Since I'm 
                // monkeypatching their template handler, I'll add this special escape
                // hatch to let the caller know to defer processing to the original code.
                if (/^!.+/.test(name)) {
                    throw new Error('USE_BGA');
                }

                if (strict) {
                    throw new Error(`No replacement "${name}" in ${JSON.stringify(replacements)} for template ${template}`);
                }
                value = '';
            }
            else if (value && typeof value === 'object' && typeof value.log === 'string') {
                // Special case for nested log structures
                const { log, args } = value;
                value = stringFromTemplate(log, args, strict);
            }
            return value;
        });
    }

    //
    // Improve on the default BGA format_block() method.
    // This method allows more flexibility in terms of defining
    // or not defining replacement parameters. It is also much
    // more informative when a template replacement fails. 
    //
    function formatBlock(templateName, replacements, strict = false) {
        let templateHtml;
        try {
            templateHtml = eval(templateName);
        }
        catch (err) {
            throw new Error(`Failed to process template name "${templateName}": ${err.message}`);
        }

        return stringFromTemplate(templateHtml, replacements, strict);
    }

    function applyMarkup(text) {
        return bga_format(text, {
            '/': t => `<i>${t}</i>`,
            '*': t => `<b>${t}</b>`,
            '_': t => `<u>${t}</u>`,
            '|': t => `<br/>`,
        });
    }

    function mapValues(obj, fn) {
        return Object.entries(obj).reduce((result, [ key, value ]) => {
            result[key] = fn(value);
            return result;
        }, {});
    }

    //
    // A helper function to replace "dojo.place(this.format_block(...), ...);"
    //
    function createFromTemplate(templateName, replacements, parentElementOrId, options = null) {
        if (typeof options !== null && typeof options !== 'object') {
            throw new Error('Expected options object');
        }
        const {
            placement = 'beforeend', // type InsertPosition = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';
            strict = false,
        } = options || {};

        const parentElement =
            typeof parentElementOrId === 'string'
                ? document.getElementById(parentElementOrId) || document.querySelector(parentElementOrId)
                : parentElementOrId;
        
        if (parentElement) {
            const html = formatBlock(templateName, replacements, strict); 
            parentElement.insertAdjacentHTML(placement, html);
        }
        else if (strict) {
            throw new Error(`Failed to locate ${parentElementOrId} for creation of template ${templateName}`);
        }
    }

    function onPreferenceChange(pref) {
        // Apply the CSS of the chosen preference value
        // (Unless it's a default pref, which appears to be
        // delivered as an array and without CSS class names)
        if (typeof pref.values === 'object' && typeof pref.values.length === 'number') return;
        const html = document.getElementsByTagName('html')[0];
        for (const [ value, settings ] of Object.entries(pref.values)) {
            if (typeof settings.cssPref !== 'string') continue;
            if (value == pref.value) {
                html.classList.add(settings.cssPref);
            }
            else {
                html.classList.remove(settings.cssPref);
            }
        }
    }

    function initPreferencesObserver() {
        dojo.query('.preference_control').on('change', e => {
            const match = e.target?.id.match(/^preference_[cf]ontrol_(\d+)$/);
            if (!match) return;
            const prefId = match[1];
            const { value } = e.target;
            gameui.prefs[prefId].value = parseInt(value, 10);
            onPreferenceChange(gameui.prefs[prefId]);
        });
    }
    
    const notificationStack = []; // Expecting either one or zero elements
    function setupNotifications() {
        console.log('notifications subscriptions setup');
        const eventNames = Object.getOwnPropertyNames(gameui.__proto__).reduce((all, name) => {
            const match = /^notify_(.+?)$/.exec(name);
            match && all.push(match[1]);
            return all;
        }, []);
        for (const eventName of eventNames) {
            dojo.subscribe(eventName, gameui, async data => {
                const fnName = `notify_${eventName}`;
                console.log(`Entering ${fnName}`, data.args);
                if (notificationStack.length) {
                    console.warn('Already in notifications!', JSON.stringify(notificationStack));
                    //debugger; // KILL
                }
                notificationStack.push(fnName);
                await gameui[fnName].call(gameui, data.args);
                console.log(`Exiting ${fnName}`);
                if (notificationStack[notificationStack.length - 1] !== fnName) {
                    console.warn(`Unexpected notifications stack: ${JSON.stringify(notificationStack)}`);
                    //debugger; // KILL
                }
                const index = notificationStack.lastIndexOf(fnName);
                notificationStack.splice(index, 1);
                gameui.notifqueue.setSynchronousDuration(0);
            });
            gameui.notifqueue.setSynchronous(eventName);
        }
        console.log(`Registered ${eventNames.length} event handlers`);
    }

    // TODO: update to new bgaPerformAction function
    async function invokeServerActionAsync(actionName, moveNumber, args = {}) {
        const {
            checkAction = true,
            playOutOfTurn = false,
        } = args;

        return new Promise((resolve, reject) => {
            try {
                if (gameui.isSpectator) {
                    console.error(`Action '${actionName}' not allowed for spectator`);
                    return reject('Invalid');
                }
                if (g_archive_mode) {
                    console.error(`Action '${actionName}' not allowed in archive mode`);
                    return reject('Invalid');
                }
                if (checkAction && !gameui.checkAction(actionName)) {
                    console.error(`Action '${actionName}' not allowed in ${gameui.currentState}`, args);
                    return reject('Invalid');
                }
                if (!playOutOfTurn && !gameui.isCurrentPlayerActive()) {
                    console.error(`Action '${actionName}' not allowed for inactive player`, args);
                    return reject('Invalid');
                }
                if (gameui.instantaneousMode) {
                    console.error(`Action '${actionName}' not allowed in instantaneous mode`, args);
                    return reject('Invalid');
                }
                const { lastMoveSent } = gameui;
                gameui.lastMoveSent = moveNumber;
                gameui.ajaxcall(`${config.gameName}/${config.gameName}/${actionName}.html`, { lock: true, m: moveNumber, ...args }, () => {}, result => {
                    if (result?.valid) {
                        resolve();
                    }
                    else {
                        gameui.lastMoveSent = lastMoveSent;
                        reject(new Error(`${actionName} failed`));
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    //  Copyright (c) Paul Johnston & Greg Holt.
    function md5(inputString) {
        var hc="0123456789abcdef";
        function rh(n) {var j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
        function ad(x,y) {var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
        function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
        function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
        function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
        function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
        function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
        function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
        function sb(x) {
            var i;var nblk=((x.length+8)>>6)+1;var blks=new Array(nblk*16);for(i=0;i<nblk*16;i++) blks[i]=0;
            for(i=0;i<x.length;i++) blks[i>>2]|=x.charCodeAt(i)<<((i%4)*8);
            blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
        }
        var i,x=sb(""+inputString),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
        for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
            a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
            b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
            c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
            d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
            a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
            b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
            c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
            d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
            a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
            b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
            c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
            d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
            a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
            b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
            c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
            d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
            a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
            b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
            c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
            d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
            a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
            b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
        }
        return rh(a)+rh(b)+rh(c)+rh(d);
    }

    const core = {
        install,
        formatBlock,
        applyMarkup,
        mapValues,
        createFromTemplate,
        stringFromTemplate,
        invokeServerActionAsync,
        md5,
    };

    // Add these methods to window for easier debugging of games on Production
    if (typeof window !== 'undefined') {
        window.pdw3 = window.pdw3 || {};
        window.pdw3.core = core;
        data.uninstallers.push(() => delete window.pdw3);
    }

    return core;
});