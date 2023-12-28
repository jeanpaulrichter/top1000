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

type AccordionTransition = {
    active: boolean,
    el_selection?: HTMLElement,
    el_expand?: HTMLElement,
    el_collapse?: HTMLElement,
    el_focus?: HTMLElement
}

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
    private selection?: HTMLElement;
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
     * @param el_game Accordion element
     * @param focus Element to focus on after transition
     */
    public toggle(el_game: HTMLElement, focus?: HTMLElement) {
        if(this.selection === el_game) {
            this.startTransition(undefined, el_game, focus);
        } else {
            this.startTransition(el_game, this.selection, focus);
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
                this.selection.children[1].classList.remove("show");
                this.selection.classList.remove("game--selected");
                this.selection = undefined;
            } else {
                this.startTransition(undefined, this.selection);
            }
        }
    }

    /**
     * Start transition animation
     * 
     * @param el_game_expand Element to expand
     * @param el_game_collapse Element to collapse
     * @param el_focus Element to focus on after transition
     */
    private startTransition(el_game_expand?: HTMLElement, el_game_collapse?: HTMLElement, el_focus?: HTMLElement) {
        if(!(el_game_expand || el_game_collapse) || this.transition.active) {
            return;
        }
        if(el_game_expand) {
            this.transition.el_selection = el_game_expand;
            this.transition.el_expand = el_game_expand.children[1] as HTMLElement;

            el_game_expand.classList.add("game--selected");
        
        } else {
            this.transition.el_expand = undefined;
            this.transition.el_selection = undefined;
        }
        if(el_game_collapse) {
            this.transition.el_collapse = el_game_collapse.children[1] as HTMLElement;
    
            el_game_collapse.classList.remove("game--selected");

        } else {
            this.transition.el_collapse = undefined;
        }
        this.transition.el_focus = el_focus;
        this.transition.active = true;
        requestAnimationFrame(this.setStart);
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