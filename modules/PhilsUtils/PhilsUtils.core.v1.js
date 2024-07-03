// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([], function () {
    const config = {
        gameName: '', // Leave this blank. Value assigned in install() method.
    };
    const data = {
        nextUniqueId: 1, // Used by stringFromTemplate when replacing ${_UNIQUEID}
    };

    //
    // Install functions into the gameui and dojo contexts.
    // Recommended to be called at the beginning of the setup()
    // method. Will not work if called in the game constructor!
    //
    // setup() {
    //     install(dojo, this); // or install(dojo, this, { debug: true });
    //
    //     // ...setup your game
    // }
    //
    function install(dojo, gameui, options = null) {
        const {
            debug = false,
        } = options || {};

        // Save the game name for use later (invoking server actions)
        config.gameName = gameui.game_name;
      
        //
        // dojo.string.substitute
        //
        const _substitute = dojo.string.substitute;
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
        gameui.__proto__.format_block = (templateName, replacements) => {
            return formatBlock(templateName, replacements, debug);
        };

        //
        // format_string_recursive
        //
        const _fsr = gameui.__proto__.format_string_recursive;
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

        // TODO: this part is less generic... maybe make the template name resolution more flexible?
        if (typeof replacements === 'object') {
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
        // Note: this regex is not 100% perfect... it watches for an escaped
        // '$' character but it's possible to break the expected behaviour
        // with input like "Hello $$${WORLD}" -- in this case, no replacement
        // happens even though it should. I figure this will never happen in
        // a real-world scenario.
        //
        return template.replace(/(?<!\$)\$\{(?<name>.*?)(?:\[(?<index>.+?)\])?\}/g, (match, name, index) => {
            if (name === '_UNIQUEID') {
                replacements[name] = `${config.gameName}_uniqueid-${data.nextUniqueId++}`;
            }

            let value = replacements[name];
            if (typeof value === 'function') {
                value = value(index);
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

    function __(text) {
        return bga_format(_(text), {
            '/': t => `<i>${t}</i>`,
            '*': t => `<b>${t}</b>`,
            '_': t => `<u>${t}</u>`,
            '|': t => `<br/>`,
        });
    }

    //
    // A helper function to replace "dojo.place(this.format_block(...), ...);"
    //
    function createFromTemplate(templateName, replacements, parentElementOrId, options = null) {
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
                await gameui[fnName].call(gameui, data.args);
                console.log(`Exiting ${fnName}`);
                gameui.notifqueue.setSynchronousDuration(0);
            });
            gameui.notifqueue.setSynchronous(eventName);
        }
        console.log(`Registered ${eventNames.length} event handlers`);
    }

    // TODO: update to new bgaPerformAction function
    async function invokeServerActionAsync(actionName, args) {
        return new Promise((resolve, reject) => {
            try {
                if (!gameui.checkAction(actionName)) {
                    console.error(`Action '${actionName}' not allowed in ${gameui.currentState}`, args);
                    return reject('Invalid');
                }
                if (!gameui.isCurrentPlayerActive()) {
                    console.error(`Action '${actionName}' not allowed for inactive player`, args);
                    return reject('Invalid');
                }
                gameui.ajaxcall(`${config.gameName}/${config.gameName}/${actionName}.html`, { lock: true, ...args }, () => {}, result => {
                    result?.valid ? resolve() : reject(`${actionName} failed`);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    const core = {
        install,
        formatBlock,
        __,
        createFromTemplate,
        stringFromTemplate,
        invokeServerActionAsync,
    };

    // Add these methods to window for easier debugging of games on Production
    if (typeof window !== 'undefined') {
        window.pdw3 = window.pdw3 || {};
        window.pdw3.core = core;
    }

    return core;
});