// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([], function () {
    const config = {
        gameName: '', // Leave this blank. Value assigned in install() method.
    };

    //
    // Install functions into the gameui and dojo contexts.
    // Recommended to be called at the beginning of the setup()
    // method. Will not work if called in the game constructor!
    //
    // setup() {
    //     init(dojo, this); // or init(dojo, this, { debug: true });
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
      
        dojo.string.substitute = (template, replacements) => {
            return stringFromTemplate(template, replacements, debug);
        };

        gameui.__proto__.format_block = (templateName, replacements) => {
            return formatBlock(templateName, replacements, debug);
        };

        //const _fsr = gameui.__proto__.format_string_recursive;
        gameui.__proto__.format_string_recursive = function() {
            // Note: mine does not perform recursion!!

            const [ template, args ] = arguments;
            return stringFromTemplate(template, args, debug);

            //return _fsr.apply(gameui, arguments);
        };
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
            let value = replacements[name];
            if (typeof value === 'function') {
                value = value(index);
            }
            if (value === undefined) {
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

    async function invokeServerActionAsync(actionName, args) {
        return new Promise((resolve, reject) => {
            try {
                if (!gameui.checkAction(actionName)) {
                    console.error(`Action '${actionName}' not allowed in ${this.currentState}`, args);
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

    return {
        install,
        formatBlock,
        createFromTemplate,
        stringFromTemplate,
        invokeServerActionAsync,
    };
});