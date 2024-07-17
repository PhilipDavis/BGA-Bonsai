// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([], () => {

    //
    // Block asynchronous execution for the specified duration
    // in milliseconds.
    //
    async function delayAsync(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    //
    // Add a CSS class name to an element and wait for the transition
    // on that element to complete.
    //
    async function transitionInAsync(elementOrId, className, timeout = 1000) {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (element.classList.contains(className)) return;
        await new Promise(resolve => {
            const timeoutId = setTimeout(done, timeout);
            function done() {
                clearTimeout(timeoutId);
                element.removeEventListener('transitionend', done);
                element.removeEventListener('transitioncancel', done);
                resolve();
            }
            element.addEventListener('transitionend', done, { once: true });
            element.addEventListener('transitioncancel', done, { once: true });
            element.classList.add(className);
        });
    }

    //
    // Remove a CSS class name from an element and wait for the transition
    // on that element to complete.
    //
    async function transitionOutAsync(elementOrId, className, timeout = 1000) {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!element.classList.contains(className)) return;
        await new Promise(resolve => {
            const timeoutId = setTimeout(done, timeout);
            function done() {
                clearTimeout(timeoutId);
                element.removeEventListener('transitionend', done);
                element.removeEventListener('transitioncancel', done);
                resolve();
            }
            element.addEventListener('transitionend', done, { once: true });
            element.addEventListener('transitioncancel', done, { once: true });
            element.classList.remove(className);
        });
    }

    //
    // Wait for an element to finish transitioning after changing
    // one or more of its style properties.
    //
    // e.g.
    // await transitionStyleAsync(div, style => {
    //     style.top = '-50px';
    //     style.opacity = 0;
    // });
    //
    async function transitionStyleAsync(div, fnStyle, timeout = 400) {
        return new Promise(resolve => {
            const timeoutId = setTimeout(done, timeout);
            function done() {
                clearTimeout(timeoutId);
                div.removeEventListener('transitionend', done);
                div.removeEventListener('transitioncancel', done);
                resolve();
            }
            div.addEventListener('transitionend', done, { once: true });
            div.addEventListener('transitioncancel', done, { once: true });
            fnStyle(div.style);
        });
    }

    //
    // Returns the 0-based offset of the element within its sibling elements
    //
    function getSiblingIndex(elementId) {
        let index = 0;
        let element = document.getElementById(elementId);
        while (element = element?.previousElementSibling) {
            index++;
        }
        return index;
    }

    class WorkflowManager {
        constructor(gameui, actionStack) {
            this.workflow = null;
            this.gameui = gameui;
            this.actionStack = actionStack;
        }

        get isRunning() {
            return !!this.workflow;
        }

        //
        // Start a new workflow
        //
        async beginAsync(workflow, temporaryClientStateArgs = {}) {
            if (this.workflow) {
                throw new Error('Workflow already in progress!');
            }
            if (!workflow) {
                throw new Error('Cannot begin null workflow');
            }
            this.workflow = workflow;
            await this.advanceAsync(temporaryClientStateArgs);
        }

        //
        // Advance the existing workflow, or start a new workflow if there
        // is no current workflow. This is useful in cases where the player
        // can skip a starting step (e.g. clicking a card directly rather
        // than clicking an actionbar button to Select a Card)
        //
        async advanceOrBeginAsync(workflow, temporaryClientStateArgs = {}) {
            if (this.workflow) {
                await this.advanceAsync(temporaryClientStateArgs);
            }
            else {
                await this.beginAsync(workflow, temporaryClientStateArgs);
            }
        }

        //
        // This advances the current workflow and optionally makes
        // some state data from the UI available to workflow methods
        // via gameui.clientStateArgs.
        // Note: this function wipes out the passed values from
        // clientStateArgs at the end of the function and it also
        // doesn't handle re-entrancy.
        //
        async advanceAsync(temporaryClientStateArgs = {}) {
            // Add the new args into client state.
            // The purpose of doing this is for making it easier
            // to advance the workflow (and subsequent cleanup)
            // in fewer lines of code. To be of any use, the
            // game-specific workflow functions must access
            // these values from `this.clientStateArgs`.
            for (const [ key, value ] of Object.entries(temporaryClientStateArgs)) {
                this.gameui.clientStateArgs[key] = value;
            }

            //
            // Iterate through workflow logic until input is required from the player.
            //
            let requiresUserInput = false;
            while (this.workflow && !requiresUserInput) {
                const { value, done } = this.workflow.next();

                if (value instanceof Action) {
                    await this.actionStack.doAsync(value);
                }
                else if (value instanceof SetClientState) {
                    const { name, description, args } = value;
                    this.gameui.setClientState(name, {
                        descriptionmyturn: description,
                        args,
                    });
                    requiresUserInput = true;
                }
                else if (value instanceof UndoLastAction) {
                    await this.actionStack.undoAsync();
                }

                if (done) {
                    this.workflow = null;
                    if (value === false) {
                        // Undo everything and revert to clean server state if a workflow returns false.
                        await this.abortAsync();
                    }
                    break;
                }
            }

            // Warning: we are not resetting values to what they were
            // prior to the `advanceAsync()` call. We expect that these
            // values are not intended to be persistent!
            for (const key of Object.keys(temporaryClientStateArgs)) {
                delete this.gameui.clientStateArgs[key];
            }
        }

        //
        // Stop the current workflow, unwind the action stack, and
        // revert all state to the clean server state. This is for
        // when the player wants to undo their entire turn.
        //
        async abortAsync() {
            console.log('Aborting workflow');
            await this.actionStack.undoAllAsync();
            this.gameui.restoreServerGameState();
            this.workflow = null;
        }
    }

    class Action {
        constructor() {
            this.fnDo = () => {};
            this.fnUndo = () => {};
            this.fnApply = obj => obj;
        }
        async doAsync() {
            return this.fnDo();
        }
        async undoAsync() {
            return this.fnUndo();
        }
        apply(obj) {
            return this.fnApply(obj);
        }
    }

    class ActionStack {
        constructor(context, fnLock, fnUnlock) {
            this.stack = [];
            this.context = context;
            this.fnLock = fnLock;
            this.fnUnlock = fnUnlock;
        }

        async doAsync(action) {
            this.fnLock.call(this.context);
            try {
                this.stack.push(action);
                await action.doAsync();
            }
            finally {
                this.fnUnlock.call(this.context);
            }
        }

        async undoAllAsync() {
            console.log('Entering undoAllAsync()');
            while (this.stack.length) {
                await this.undoAsync();
            }
            console.log('Exiting undoAllAsync()');
        }

        async undoAsync() {
            try {
                this.fnLock.call(this.context);
                while (true) {
                    const action = this.stack.pop();
                    await action.undoAsync();
                    if (action.isCheckpoint()) {
                        break;
                    }
                }
            }
            finally {
                this.fnUnlock.call(this.context);
            }
        }
        
        canUndo() {
            return this.stack.length > 0;
        }

        // Serialize the action data for sending to the server
        apply() {
            // Collapse array of action data into an object...
            // and collapse duplicate keys into an array
            const array = this.stack.reduce((array, action) => action.apply(array), []);
            const obj = array.reduce((obj, { action, data }) => {
                if (data === undefined) {
                    throw new Error(`Missing data property while applying action '${action}'`);
                }
                const prev = obj[action];
                if (prev === undefined) {
                    obj[action] = [ data ];
                }
                else {
                    obj[action] = [ ...prev, data ];
                }
                return obj;
            }, {});

            // Finally, collapse singleton arrays for convenience
            for (const [ key, value ] of Object.entries(obj)) {
                if (value.length === 1) {
                    obj[key] = value[0];
                }
            }
            return obj;
        }

        clear() {
            this.stack.splice(0, this.stack.length);
        }
    }
    
    // Helper class to simplify workflow generators
    class SetClientState {
        constructor(name, description, args = {}) {
            this.name = name;
            this.description = description;
            this.args = args;
        }
    }

    // Helper class to simplify workflow generators
    class UndoLastAction {}

    // Force DOM element positions to be recalculated
    function reflow(element = document.documentElement) {
        void(element.offsetHeight);
    }

    return {
        delayAsync,
        transitionInAsync,
        transitionOutAsync,
        transitionStyleAsync,
        getSiblingIndex,
        WorkflowManager,
        Action,
        ActionStack,
        SetClientState,
        UndoLastAction,
        reflow,
    };
});
