/** @odoo-module */

import { createTourMethods } from "@point_of_sale/../tests/tours/helpers/utils";

class Do {
    clickOk() {
        return [
            {
                content: `go back`,
                trigger: `.receipt-screen .button.next`,
            },
        ];
    }
    clickBillButton() {
        return [
            {
                content: "click bill button",
                trigger: '.control-button:contains("Bill")',
            },
        ];
    }
}

class Check {
    isShown() {
        return [
            {
                content: "Bill screen is shown",
                trigger: '.receipt-screen h1:contains("Bill Printing")',
                run: () => {},
            },
        ];
    }
    isQRCodeShown() {
        return [
            {
                content: "QR codes are shown",
                trigger: '#posqrcode',
                run: () => {},
            },
        ];
    }
    isQRCodeNotShown() {
        return [
            {
                content: "QR codes are shown",
                trigger: 'body:not(:has(#posqrcode))',
                run: () => {},
            },
        ];
    }
}

// FIXME: this is a horrible hack to export an object as named exports.
// eslint-disable-next-line no-undef
Object.assign(__exports, createTourMethods("BillScreen", Do, Check));
