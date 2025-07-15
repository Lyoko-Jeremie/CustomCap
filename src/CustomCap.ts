import {solvePoWPuzzle} from "./crypto-puzzle/TimeLockPuzzle";
import {ready} from "libsodium-wrappers";

interface ChallengeInterface {
    init(): Promise<any>;

    reset(): Promise<any>;

    cleanup(): any;

    solveChallenge(puzzle: string): Promise<string>;

    setWorkersCount(workers: number): void;

    setProgressCallback(cb?: (p: number) => void): void;

    progressCallback?: (p: number) => void;
    stopIt: boolean;
    workersCount: number;
}

class ChallengeTimeLockPuzzlesImpl implements ChallengeInterface {
    // Time-lock puzzles and timed-release Crypto
    // https://people.csail.mit.edu/rivest/pubs/RSW96.pdf

    progressCallback?: (p: number) => void;
    stopIt: boolean = false;
    workersCount = 0;

    setWorkersCount(workers: number) {
    }

    setProgressCallback(cb?: (p: number) => void): void {
        this.progressCallback = cb;
    }

    cleanup(): any {
    }

    async init(): Promise<any> {
        // init libsodium-wrappers
        await ready;
    }

    async reset(): Promise<any> {
    }

    async solveChallenge(puzzle: string): Promise<string> {
        let lastShowProgressTime: number = 0;
        const solvedMessage = await solvePoWPuzzle(puzzle,
            async (progress: number) => {

                const now = Date.now();
                if (now - lastShowProgressTime < 200) {
                    // 防止过于频繁的更新， Firefox DOM 事件循环需要更多的时间来处理
                    return;
                }
                lastShowProgressTime = now;

                this.progressCallback?.(progress);

                await sleep(0); // 让出事件循环，避免阻塞
                if (this.stopIt) {
                    throw new Error("Solving stopped by user");
                }
            }
        );
        return solvedMessage;
    }

}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// https://developer.mozilla.org/zh-CN/docs/Web/API/Web_components
export class CapWidget extends HTMLElement {
    #resetTimer: null | ReturnType<typeof setTimeout> = null;
    token: string | null = null;
    #shadow?: ShadowRoot;
    #div?: HTMLDivElement;
    #host?: this;
    #solving = false;
    #eventHandlers: Map<string, any> = new Map();

    challengeImpl: ChallengeInterface;

    boundHandleProgress: CallableFunction;
    boundHandleSolve: CallableFunction;
    boundHandleError: CallableFunction;
    boundHandleReset: CallableFunction;

    CAP_CUSTOM_FETCH?: typeof fetch;

    set_CAP_CUSTOM_FETCH(fetchFn: typeof fetch) {
        if (typeof fetchFn !== 'function') {
            throw new Error('CAP_CUSTOM_FETCH must be a function');
        }
        this.CAP_CUSTOM_FETCH = fetchFn;
    }

    capFetch(input: RequestInfo | URL, init?: RequestInit) {
        console.log('CAP_CUSTOM_FETCH', this?.CAP_CUSTOM_FETCH);
        if (this?.CAP_CUSTOM_FETCH) {
            return this.CAP_CUSTOM_FETCH(input, init);
        }
        return fetch(input, init);
    };

    getI18nText(key: string, defaultValue: string): string {
        const r = this.getAttribute(`data-cap-i18n-${key}`) ?? defaultValue;
        console.log('getI18nText', key, this.getAttribute(`data-cap-i18n-${key}`), r);
        return r;
    }

    hasI18nText(key: string): boolean {
        console.log('hasI18nText', key, this.getAttribute(`data-cap-i18n-${key}`));
        const r = !!this.getAttribute(`data-cap-i18n-${key}`);
        console.log('hasI18nText', key, this.getAttribute(`data-cap-i18n-${key}`), r);
        return r;
    }

    // 一个包含元素需要变更通知的所有属性名称的数组。
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Web_components/Using_custom_elements#%E5%93%8D%E5%BA%94%E5%B1%9E%E6%80%A7%E5%8F%98%E5%8C%96
    static get observedAttributes() {
        return [
            "onsolve",
            "onprogress",
            "onreset",
            "onerror",
            "data-cap-worker-count",
            "data-cap-i18n-initial-state",
            "[cap]",
        ];
    }

    constructor(challengeImpl: ChallengeInterface) {
        super();
        if (this.#eventHandlers) {
            this.#eventHandlers.forEach((handler, eventName) => {
                this.removeEventListener(eventName.slice(2), handler);
            });
        }

        this.#eventHandlers = new Map();
        this.boundHandleProgress = this.handleProgress.bind(this);
        this.boundHandleSolve = this.handleSolve.bind(this);
        this.boundHandleError = this.handleError.bind(this);
        this.boundHandleReset = this.handleReset.bind(this);

        this.challengeImpl = challengeImpl;
    }

    async initialize() {
        await this.challengeImpl.init();
    }

    // 在属性更改、添加、移除或替换时调用。有关此回调的更多详细信息，请参见响应属性变化。
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Web_components/Using_custom_elements#%E5%93%8D%E5%BA%94%E5%B1%9E%E6%80%A7%E5%8F%98%E5%8C%96
    attributeChangedCallback(name: string, oldValue: any, newValue: string) {
        if (name.startsWith("on")) {
            const eventName = name.slice(2);
            const oldHandler = this.#eventHandlers.get(name);
            if (oldHandler) {
                this.removeEventListener(eventName, oldHandler);
            }

            if (newValue) {
                const handler = (event: any) => {
                    const callback = this.getAttribute(name);
                    if (typeof (window as any)[callback as any] === "function") {
                        (window as any)[callback as any].call(this, event);
                    }
                };
                this.#eventHandlers.set(name, handler);
                this.addEventListener(eventName, handler);
            }
        }

        if (name === "data-cap-worker-count") {
            this.setWorkersCount(parseInt(newValue));
        }

        if (
            name === "data-cap-i18n-initial-state" &&
            this.#div &&
            this.#div?.querySelector("p")?.innerText
        ) {
            this.#div.querySelector("p")!.innerText = this.getI18nText(
                "initial-state",
                "I'm a human"
            );
        }
    }

    // 每当元素添加到文档中时调用。规范建议开发人员尽可能在此回调中实现自定义元素的设定，而不是在构造函数中实现。
    async connectedCallback() {
        this.#host = this;
        this.#shadow = this.attachShadow({mode: "open"});
        this.#div = document.createElement("div");
        this.createUI();
        this.addEventListeners();
        await this.initialize();
        this.#div.removeAttribute("disabled");

        const workers = this.getAttribute("data-cap-worker-count");
        const parsedWorkers = workers ? parseInt(workers, 10) : null;
        this.setWorkersCount(parsedWorkers || navigator.hardwareConcurrency || 8);
        const fieldName =
            this.getAttribute("data-cap-hidden-field-name") || "cap-token";
        this.#host.innerHTML = `<input type="hidden" name="${fieldName}">`;
    }

    async solve() {
        if (this.#solving) {
            return;
        }

        try {
            this.#solving = true;
            this.updateUI(
                "verifying",
                this.getI18nText("verifying-label", "Verifying..."),
                true
            );

            this.#div!.setAttribute(
                "aria-label",
                this.getI18nText(
                    "verifying-aria-label",
                    "Verifying you're a human, please wait"
                )
            );

            this.dispatchEvent("progress", {progress: 0});

            try {
                const apiEndpoint = this.getAttribute("data-cap-api-endpoint");
                if (!apiEndpoint) throw new Error("Missing API endpoint");

                const t1 = Date.now();

                const respChallenge: {
                    success: boolean;
                    challenge: string;
                } = await (
                    await this.capFetch(`${apiEndpoint}/challenge`, {
                        method: "GET",
                    })
                ).json();

                if (!respChallenge.success) {
                    this.error("Failed to get challenge");
                    throw new Error("Failed to get challenge");
                }

                let challenges: string = respChallenge.challenge;

                const solutions = await this.solveChallenges(challenges);

                const resp: {
                    success: boolean;
                    token: string;
                    expires: string;
                } = await (
                    await this.capFetch(`${apiEndpoint}/redeem`, {
                        method: "POST",
                        body: JSON.stringify({solutions}),
                        headers: {"Content-Type": "application/json"},
                    })
                ).json();
                console.log('resp', resp);

                this.dispatchEvent("progress", {progress: 100});

                if (!resp.success) throw new Error("Invalid solution");
                const fieldName =
                    this.getAttribute("data-cap-hidden-field-name") || "cap-token";
                if (this.querySelector(`input[name='${fieldName}']`)) {
                    (this.querySelector(`input[name='${fieldName}']`) as any)!.value = resp.token;
                }

                const t2 = Date.now();
                const usedTime = t2 - t1;

                this.dispatchEvent("solve", {token: resp.token, usedTime: usedTime});
                this.token = resp.token;

                if (this.#resetTimer) clearTimeout(this.#resetTimer);
                const expiresIn = new Date(resp.expires).getTime() - Date.now();
                if (expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000) {
                    this.#resetTimer = setTimeout(() => this.reset(), expiresIn);
                } else {
                    this.error("Invalid expiration time");
                }

                this.#div!.setAttribute(
                    "aria-label",
                    this.getI18nText(
                        "verified-aria-label",
                        "We have verified you're a human, you may now continue"
                    )
                );

                return {success: true, token: this.token};
            } catch (err) {
                this.#div!.setAttribute(
                    "aria-label",
                    this.getI18nText(
                        "error-aria-label",
                        "An error occurred, please try again"
                    )
                );
                this.error((err as any)?.message ?? err);
                throw err;
            }
        } finally {
            this.#solving = false;
        }
    }

    async solveChallenges(puzzle: string) {
        this.challengeImpl.setProgressCallback((p) => {
            this.dispatchEvent("progress", {progress: p});
        });
        return await this.challengeImpl.solveChallenge(puzzle);
    }

    setWorkersCount(workers: number) {
        this.challengeImpl.setWorkersCount(workers);
    }

    createUI() {
        if (!this.#div || !this.#shadow) {
            // never go there
            console.error('[CustomCap] createUI() not initialized. This should never happen.');
            throw new Error("[CustomCap] createUI() not initialized. never go there.");
        }
        this.#div.classList.add("captcha");
        this.#div.setAttribute("role", "button");
        this.#div.setAttribute("tabindex", "0");
        this.#div.setAttribute(
            "aria-label",
            this.getI18nText("verify-aria-label", "Click to verify you're a human")
        );
        this.#div.setAttribute("aria-live", "polite");
        this.#div.setAttribute("disabled", "true");
        // this.#div.innerHTML = `<div class="checkbox" part="checkbox"></div><p part="label">${this.getI18nText(
        //     "initial-state",
        //     "I'm a human"
        // )}</p><a part="attribution" aria-label="Secured by Cap" href="https://capjs.js.org/" class="credits" target="_blank" rel="follow noopener">Cap</a>`;
        this.#div.innerHTML = `<div class="checkbox" part="checkbox"></div><p part="label">${this.getI18nText(
            "initial-state",
            "I'm a human"
        )}</p><a part="attribution" class="credits" ${
            this.hasI18nText('no-credits-link') ? '' :
                `href="${this.getI18nText(
                    "credits-link",
                    'https://people.csail.mit.edu/rivest/pubs/RSW96.pdf'
                )}"`
        } target="_blank" rel="follow noopener">${this.getI18nText(
            "credits-string",
            "PoW Challenge"
        )}</a>`;
        // this.#div.innerHTML = `
        // <div class="checkbox" part="checkbox"></div>
        // <p part="label">${this.getI18nText(
        //     "initial-state",
        //     "I'm a human"
        // )}</p>`;

        this.#shadow!.innerHTML = `
<style>
.captcha,.captcha * {
    box-sizing:border-box;
}
.captcha{
    background-color:var(--cap-background,#fdfdfd);
    border:1px solid var(--cap-border-color,#dddddd8f);
    border-radius:var(--cap-border-radius,14px);
    user-select:none;
    height:var(--cap-widget-height, 4em);
    width:var(--cap-widget-width, 15em);
    display:flex;
    align-items:center;
    padding:var(--cap-widget-padding,14px);
    gap:var(--cap-gap,15px);
    cursor:pointer;
    transition:filter .2s,transform .2s;
    position:relative;
    -webkit-tap-highlight-color:rgba(255,255,255,0);
    overflow:hidden;
    color:var(--cap-color,#212121)
}
.captcha:hover{
    filter:brightness(98%)
}
.checkbox{
    width:var(--cap-checkbox-size,25px);
    height:var(--cap-checkbox-size,25px);
    border:var(--cap-checkbox-border,1px solid #aaaaaad1);
    border-radius:var(--cap-checkbox-border-radius,6px);
    background-color:var(--cap-checkbox-background,#fafafa91);
    transition:opacity .2s;
    margin-top:var(--cap-checkbox-margin,2px);
    margin-bottom:var(--cap-checkbox-margin,2px)
 }
.captcha *{
    font-family:var(--cap-font,system,-apple-system,"BlinkMacSystemFont",".SFNSText-Regular","San Francisco","Roboto","Segoe UI","Helvetica Neue","Lucida Grande","Ubuntu","arial",sans-serif)
}
.captcha p{
    margin:0;
    font-weight:500;
    font-size:15px;
    user-select:none;
    transition:opacity .2s
}
.captcha[data-state=verifying] .checkbox{
    background: none;
    display:flex;
    align-items:center;
    justify-content:center;
    transform: scale(1.1);
    border: none;
    border-radius: 50%;
    background: conic-gradient(var(--cap-spinner-color,#000) 0%, var(--cap-spinner-color,#000) var(--progress, 0%), var(--cap-spinner-background-color,#eee) var(--progress, 0%), var(--cap-spinner-background-color,#eee) 100%);
    position: relative;
}
.captcha[data-state=verifying] .checkbox::after {
    content: "";
    background-color: var(--cap-background,#fdfdfd);
    width: calc(100% - var(--cap-spinner-thickness,5px));
    height: calc(100% - var(--cap-spinner-thickness,5px));
    border-radius: 50%;
    margin:calc(var(--cap-spinner-thickness,5px) / 2)
}
.captcha[data-state=done] .checkbox{
    border:1px solid transparent;
    background-image:var(--cap-checkmark,url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cstyle%3E%40keyframes%20anim%7B0%25%7Bstroke-dashoffset%3A23.21320343017578px%7Dto%7Bstroke-dashoffset%3A0%7D%7D%3C%2Fstyle%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22%2300a67d%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m5%2012%205%205L20%207%22%20style%3D%22stroke-dashoffset%3A0%3Bstroke-dasharray%3A23.21320343017578px%3Banimation%3Aanim%20.5s%20ease%22%2F%3E%3C%2Fsvg%3E"));
    background-size:cover
}
.captcha[data-state=error] .checkbox{
    border:1px solid transparent;
    background-image:var(--cap-error-cross,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24'%3E%3Cpath fill='%23f55b50' d='M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8'/%3E%3C/svg%3E"));
    background-size:cover
}
.captcha[disabled]{
    cursor:not-allowed
}
.captcha[disabled][data-state=verifying]{
    cursor:progress
}.captcha[disabled][data-state=done]{
    cursor:default
}
.captcha .credits{
    position:absolute;
    bottom:5px;
    right:5px;
    font-size:var(--cap-credits-font-size,12px);
    color:var(--cap-color,#dadada);
    opacity:var(--cap-opacity-hover,0.8);
    text-underline-offset: 1.5px;
}
</style>`;


        this.#shadow!.appendChild(this.#div);
    }

    addEventListeners() {
        if (!this.#div) return;

        // this.#div.querySelector("a").addEventListener("click", (e: any) => {
        //     e.stopPropagation();
        //     e.preventDefault();
        //     window.open("https://capjs.js.org", "_blank");
        // });

        this.#div.addEventListener("click", () => {
            if (!this.#div!.hasAttribute("disabled")) this.solve().catch(console.error);
        });

        this.#div.addEventListener("keydown", (e: any) => {
            if (
                (e.key === "Enter" || e.key === " ") &&
                !this.#div!.hasAttribute("disabled")
            ) {
                e.preventDefault();
                e.stopPropagation();
                this.solve().catch(console.error);
            }
        });

        this.addEventListener("progress", this.boundHandleProgress as any);
        this.addEventListener("solve", this.boundHandleSolve as any);
        this.addEventListener("error", this.boundHandleError as any);
        this.addEventListener("reset", this.boundHandleReset as any);
    }

    updateUI(state: string, text: string, disabled = false) {
        if (!this.#div) return;

        this.#div.setAttribute("data-state", state);

        this.#div.querySelector("p")!.innerText = text;

        if (disabled) {
            this.#div.setAttribute("disabled", "true");
        } else {
            this.#div.removeAttribute("disabled");
        }
    }

    handleProgress(event: any) {
        if (!this.#div) return;

        const progressElement = this.#div.querySelector("p");
        const checkboxElement = this.#div.querySelector(".checkbox") as HTMLDivElement;

        if (progressElement && checkboxElement) {
            checkboxElement.style.setProperty(
                "--progress",
                `${event.detail.progress}%`
            );
            progressElement.innerText = `${this.getI18nText(
                "verifying-label",
                "Verifying..."
            )} ${event.detail.progress}%`;
        }
        this.executeAttributeCode("onprogress", event);
    }

    handleSolve(event: any) {
        console.log('event', event);
        console.log('usedTime', event.detail.usedTime);
        let usedTime = event.detail.usedTime || 0;
        let usedTimeS = '';
        if (usedTime > 0) {
            usedTime = (usedTime / 1000).toFixed(1);
            usedTimeS = ` (${usedTime}s)`;
        }
        this.updateUI(
            "done",
            this.getI18nText("solved-label", "You're a human") + `${usedTimeS}`,
            true
        );
        this.executeAttributeCode("onsolve", event);
    }

    handleError(event: any) {
        this.updateUI(
            "error",
            this.getI18nText("error-label", "Error. Try again.")
        );
        this.executeAttributeCode("onerror", event);
    }

    handleReset(event: any) {
        this.updateUI("", this.getI18nText("initial-state", "I'm a human"));
        this.executeAttributeCode("onreset", event);
    }

    executeAttributeCode(attributeName: string, event: any) {
        const code = this.getAttribute(attributeName);
        if (!code) {
            return;
        }

        new Function("event", code).call(this, event);
    }

    error(message = "Unknown error") {
        console.error("[cap]", message);
        this.dispatchEvent("error", {isCap: true, message});
    }

    dispatchEvent(eventName: string | any, detail = {}) {
        const event = new CustomEvent(eventName, {
            bubbles: true,
            composed: true,
            detail,
        });
        return super.dispatchEvent(event);
    }

    async reset() {
        // stop the solving process if it's running
        this.stopIt = true;
        // wait for a moment to ensure the stop is effective
        await sleep(1);
        // reset the state
        this.stopIt = false;
        if (this.#resetTimer) {
            clearTimeout(this.#resetTimer);
            this.#resetTimer = null;
        }
        this.dispatchEvent("reset");
        this.token = null;
        await this.challengeImpl.reset();
        const fieldName =
            this.getAttribute("data-cap-hidden-field-name") || "cap-token";
        if (this.querySelector(`input[name='${fieldName}']`)) {
            (this.querySelector(`input[name='${fieldName}']`) as any)!.value = "";
        }
    }

    get tokenValue() {
        return this.token;
    }

    // 每当元素从文档中移除时调用。
    disconnectedCallback() {
        this.removeEventListener("progress", this.boundHandleProgress as any);
        this.removeEventListener("solve", this.boundHandleSolve as any);
        this.removeEventListener("error", this.boundHandleError as any);
        this.removeEventListener("reset", this.boundHandleReset as any);

        this.#eventHandlers.forEach((handler, eventName) => {
            this.removeEventListener(eventName.slice(2), handler);
        });
        this.#eventHandlers.clear();

        if (this.#shadow) {
            this.#shadow.innerHTML = "";
        }

        this.reset().catch(console.error);
        this.cleanup();
    }

    cleanup() {
        if (this.#resetTimer) {
            clearTimeout(this.#resetTimer);
            this.#resetTimer = null;
        }
        this.challengeImpl.cleanup();
    }

    _stopIt = false;

    set stopIt(value: boolean) {
        this._stopIt = value;
        this.challengeImpl.stopIt = value;
    }

    stop() {
        this.stopIt = true;
    }
}

export class CapWidgetTimeLockPuzzles extends CapWidget {
    constructor() {
        super(new ChallengeTimeLockPuzzlesImpl());
    }
}

class Cap {
    widget: CapWidget;

    solve: CallableFunction;
    reset: CallableFunction;
    addEventListener: CallableFunction;

    constructor(config: {
        apiEndpoint?: string,
    } = {}, el?: HTMLElement) {
        let widget = el || document.createElement("cap-widget");

        Object.entries(config).forEach(([a, b]) => {
            widget.setAttribute(a, b);
        });

        if (config.apiEndpoint) {
            widget.setAttribute("data-cap-api-endpoint", config.apiEndpoint);
        } else {
            widget.remove();
            throw new Error("Missing API endpoint");
        }

        this.widget = widget as CapWidget;
        this.solve = this.widget.solve.bind(this.widget);
        this.reset = this.widget.reset.bind(this.widget);
        this.addEventListener = this.widget.addEventListener.bind(this.widget);

        Object.defineProperty(this, "token", {
            get: () => (widget as CapWidget).token,
            configurable: true,
            enumerable: true,
        });

        if (!el) {
            widget.style.display = "none";
            document.documentElement.appendChild(widget);
        }
    }
}

(window as any).Cap = Cap;

if (!customElements.get("cap-widget") && !(window as any)?.CAP_DONT_SKIP_REDEFINE) {
    customElements.define("cap-widget", CapWidgetTimeLockPuzzles);
} else {
    console.warn(
        "[CustomCap] the cap-widget element has already been defined, skipping re-defining it.\nto prevent this, set window.CAP_DONT_SKIP_REDEFINE to true"
    );
}
