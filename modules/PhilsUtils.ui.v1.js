// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([], () => {

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

    return {
        transitionInAsync,
        transitionOutAsync,
    };
});
