/** @odoo-module **/

import { Chatter } from "@mail/core/web/chatter"; // Import Chatter component from the mail module

// Override Chatter to customize button functionality
class CustomChatter extends Chatter {

    onClickFollow() {
        console.log("Child success");
    }
    toggleComposer(mode){
        console.log("Child ", mode)
    }

}

// Register the custom component to replace the original one
export { CustomChatter };
