/** @odoo-module */

import { createTourMethods } from "@point_of_sale/../tests/tours/helpers/utils";

class Do {
    /**
     * Note: Maximum of 2 characters because NumberBuffer only allows 2 consecutive
     * fast inputs. Fast inputs is the case in tours.
     *
     * @param {String} keys space-separated input keys
     */
    pressNumpad(keys) {
        const numberChars = "0 1 2 3 4 5 6 7 8 9 C".split(" ");
        const modeButtons = "+1 +10 +2 +20 +5 +50".split(" ");
        const decimalSeparators = ", .".split(" ");
        function generateStep(key) {
            let trigger;
            if (numberChars.includes(key)) {
                trigger = `.popup-numpad .number-char:contains("${key}")`;
            } else if (modeButtons.includes(key)) {
                trigger = `.popup-numpad .mode-button:contains("${key}")`;
            } else if (key === "Backspace") {
                trigger = `.popup-numpad .numpad-backspace`;
            } else if (decimalSeparators.includes(key)) {
                trigger = `.popup-numpad .number-char.dot`;
            }
            return {
                content: `'${key}' pressed in numpad`,
                trigger,
                mobile: false,
            };
        }
        return keys.split(" ").map(generateStep);
    }
    enterValue(keys) {
        const numpadKeys = keys.split('').join(' ');
        return [
            ...this.pressNumpad(numpadKeys),
            ...this.fillPopupValue(keys)
        ];
    }
    fillPopupValue(keys) {
        return [
            {
                content: `'${keys}' inputed in the number popup`,
                trigger: ".popup .value",
                run: `text ${keys}`,
                mobile: true,
            },
        ];
    }
    clickConfirm() {
        return [
            {
                content: "click confirm button",
                trigger: ".popup-number .footer .confirm",
                mobile: false,
            },
            {
                content: "click confirm button",
                trigger: ".popup .footer .confirm",
                mobile: true,
            }
        ];
    }
}

class Check {
    isShown() {
        return [
            {
                content: "number popup is shown",
                trigger: ".modal-dialog .popup .value",
                run: () => {},
            },
        ];
    }
    inputShownIs(val) {
        return [
            {
                content: "number input element check",
                trigger: ".modal-dialog .popup-number",
                run: () => {},
                mobile: false,
            },
            {
                content: `input shown is '${val}'`,
                trigger: `.modal-dialog .popup .value:contains("${val}")`,
                run: () => {},
                mobile: false,
            },
        ];
    }
}

// FIXME: this is a horrible hack to export an object as named exports.
// eslint-disable-next-line no-undef
Object.assign(__exports, createTourMethods("NumberPopup", Do, Check));
