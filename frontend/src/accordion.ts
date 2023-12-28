/*
This file is part of http://www.github.com/jeanpaulrichter/top1000
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 3
of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
*/

import { AccordionTransition } from "types.js";

/**
 * Manager of accordion transitions
 */
export class AccordionManager {
    /**
     * Information about current transition
     */
    private transition: AccordionTransition;
    /**
     * Currently selected element
     */
    protected selection?: HTMLElement;
    /**
     * Length of transition in milliseconds
     */
    private static duration = 350;

    constructor() {
        this.transition = {
            "active": false
        };
    }

    /**
     * Toggle transition
     * 
     * @param el Accordion element
     * @param focus Element to focus on after transition
     */
    public toggle(el: HTMLElement, focus?: HTMLElement): boolean {
        if(this.selection === el) {
            return this.startTransition(undefined, el, focus);
        } else {
            return this.startTransition(el, this.selection, focus);
        }
    }

    /**
     * Close currently selected accordion element
     * 
     * @param skipAnimation Skip transition animation
     */
    public close(skipAnimation = false) {
        if(this.selection !== undefined) {
            if(skipAnimation) {
                this.selection.classList.remove("show");
                this.selection = undefined;
            } else {
                this.startTransition(undefined, this.selection);
            }
        }
    }

    protected isActive() {
        return this.transition.active;
    }

    /**
     * Start transition animation
     * 
     * @param el_expand Element to expand
     * @param el_collapse Element to collapse
     * @param el_focus Element to focus on after transition
     */
    protected startTransition(el_expand?: HTMLElement, el_collapse?: HTMLElement, el_focus?: HTMLElement) {
        if(!(el_expand || el_collapse) || this.transition.active) {
            return false;
        }
        if(el_expand) {
            this.transition.el_selection = el_expand;
            this.transition.el_expand = el_expand;
        } else {
            this.transition.el_expand = undefined;
            this.transition.el_selection = undefined;
        }
        if(el_collapse) {
            this.transition.el_collapse = el_collapse;
        } else {
            this.transition.el_collapse = undefined;
        }
        this.transition.el_focus = el_focus;
        this.transition.active = true;
        requestAnimationFrame(this.setStart);
        return true;
    }

    /**
     * Set element start sizes
     */
    private setStart = () => {
        if(this.transition.el_expand) {
            this.transition.el_expand.classList.add("show");
            this.transition.el_expand.style.height = "0px";
        }        
        if(this.transition.el_collapse) {
            this.transition.el_collapse.style.height = this.transition.el_collapse.scrollHeight + "px";
        }
        requestAnimationFrame(this.setEnd);
    }

    /**
     * Set element end sizes
     */
    private setEnd = () => {
        if(this.transition.el_expand) {
            this.transition.el_expand.style.height = this.transition.el_expand.scrollHeight + "px";
        }
        if(this.transition.el_collapse) {
            this.transition.el_collapse.style.height = "0px";
        }
        setTimeout(this.endTransition, AccordionManager.duration);
    }

    /**
     * End transition callback
     */
    private endTransition = () => {
        if(this.transition.el_expand) {
            this.transition.el_expand.style.height = "";
        }
        if(this.transition.el_collapse) {
            this.transition.el_collapse.classList.remove("show");
        }
        if(this.transition.el_focus) {
            this.transition.el_focus.focus();
        }
        this.selection = this.transition.el_selection;
        this.transition.active = false;
    }
}

export class AccordionGameManger extends AccordionManager {
    constructor() {
        super();
    }

    /**
     * Toggle transition
     * 
     * @param el_game Accordion element
     * @param focus Element to focus on after transition
     */
    public toggle(el_game: HTMLElement, focus?: HTMLElement) {
        if(super.isActive()) {
            return false;
        }
        if(this.selection === el_game.children[1]) {
            el_game.classList.remove("game--selected");
            return super.startTransition(undefined, el_game.children[1] as HTMLElement, focus);            
        } else {
            el_game.classList.add("game--selected");
            if(this.selection) {
                this.selection.parentElement?.classList.remove("game--selected");
            }
            return super.startTransition(el_game.children[1] as HTMLElement, this.selection, focus);
        }
    }

    /**
     * Close currently selected accordion element
     * 
     * @param skipAnimation Skip transition animation
     */
    public close(skipAnimation = false) {
        if(this.selection !== undefined) {
            this.selection.parentElement?.classList.remove("game--selected");
            if(skipAnimation) {
                this.selection.classList.remove("show");
                this.selection = undefined;
            } else {
                super.startTransition(undefined, this.selection);
            }
        }
    }
}
