/* @odoo-module */

import { AttachmentList } from "@mail/core/common/attachment_list";
import { Composer } from "@mail/core/common/composer";
import { useEmojiPicker } from "@web/core/emoji_picker/emoji_picker";
import { ImStatus } from "@mail/core/common/im_status";
import { LinkPreviewList } from "@mail/core/common/link_preview_list";
import { MessageConfirmDialog } from "@mail/core/common/message_confirm_dialog";
import { MessageInReply } from "@mail/core/common/message_in_reply";
import { MessageNotificationPopover } from "@mail/core/common/message_notification_popover";
import { MessageReactionMenu } from "@mail/core/common/message_reaction_menu";
import { MessageReactions } from "@mail/core/common/message_reactions";
import { MessageSeenIndicator } from "@mail/core/common/message_seen_indicator";
import { useMessaging, useStore } from "@mail/core/common/messaging_hook";
import { RelativeTime } from "@mail/core/common/relative_time";
import { convertBrToLineBreak, htmlToTextContentInline } from "@mail/utils/common/format";
import { isEventHandled, markEventHandled } from "@web/core/utils/misc";

import {
    Component,
    onMounted,
    onPatched,
    useChildSubEnv,
    useEffect,
    useRef,
    useState,
} from "@odoo/owl";

import { ActionSwiper } from "@web/core/action_swiper/action_swiper";
import { hasTouch } from "@web/core/browser/feature_detection";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { _t } from "@web/core/l10n/translation";
import { usePopover } from "@web/core/popover/popover_hook";
import { useService } from "@web/core/utils/hooks";
import { url } from "@web/core/utils/urls";

/**
 * @typedef {Object} Props
 * @property {boolean} [hasActions=true]
 * @property {boolean} [highlighted]
 * @property {function} [onParentMessageClick]
 * @property {import("@mail/core/common/message_model").Message} message
 * @property {import("@mail/utils/common/hooks").MessageToReplyTo} [messageToReplyTo]
 * @property {boolean} [squashed]
 * @property {import("@mail/core/common/thread_model").Thread} [thread]
 * @extends {Component<Props, Env>}
 */
export class Message extends Component {
    // This is the darken version of #71639e
    static SHADOW_LINK_COLOR = "#66598f";
    static SHADOW_LINK_HOVER_COLOR = "#564b79";
    static components = {
        ActionSwiper,
        AttachmentList,
        Composer,
        Dropdown,
        DropdownItem,
        LinkPreviewList,
        MessageInReply,
        MessageReactions,
        MessageSeenIndicator,
        ImStatus,
        Popover: MessageNotificationPopover,
        RelativeTime,
    };
    static defaultProps = {
        hasActions: true,
        isInChatWindow: false,
    };
    static props = [
        "hasActions?",
        "isInChatWindow?",
        "highlighted?",
        "onParentMessageClick?",
        "message",
        "messageEdition?",
        "messageToReplyTo?",
        "squashed?",
        "thread?",
    ];
    static template = "mail.Message";

    /** @type {HTMLStyleElement} */
    shadowStyle;
    /** @type {ShadowRoot} */
    shadowRoot;

    setup() {
        this.popover = usePopover(this.constructor.components.Popover, { position: "top" });
        this.state = useState({
            isEditing: false,
            isHovered: false,
            isClicked: false,
            expandOptions: false,
            originalEmail: false,
            emailHeaderOpen: false,
        });
        this.root = useRef("root");
        this.hasTouch = hasTouch;
        this.messageBody = useRef("body");
        this.shadowBody = useRef("shadowBody");
        this.messaging = useMessaging();
        this.store = useStore();
        this.rpc = useService("rpc");
        /** @type {import("@mail/core/common/thread_service").ThreadService} */
        this.threadService = useState(useService("mail.thread"));
        /** @type {import("@mail/core/common/message_service").MessageService} */
        this.messageService = useState(useService("mail.message"));
        /** @type {import("@mail/core/common/attachment_service").AttachmentService} */
        this.attachmentService = useService("mail.attachment");
        this.user = useService("user");
        this.dialog = useService("dialog");
        this.ui = useState(useService("ui"));
        this.openReactionMenu = this.openReactionMenu.bind(this);
        useChildSubEnv({
            alignedRight: this.isAlignedRight,
        });
        useEffect(
            (editingMessage) => {
                if (editingMessage === this.props.message) {
                    this.enterEditMode();
                }
            },
            () => [this.props.messageEdition?.editingMessage]
        );
        useEffect(
            () => {
                if (!this.shadowRoot) {
                    return;
                }
                if (this.state.originalEmail) {
                    this.shadowRoot.removeChild(this.shadowStyle);
                } else {
                    this.shadowRoot.insertBefore(this.shadowStyle, this.shadowRoot.firstChild);
                }
            },
            () => [this.state.originalEmail]
        );
        onPatched(() => {
            if (this.props.highlighted && this.root.el) {
                this.root.el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
        this.emojiPickerRef = useRef("emoji-picker");
        if (this.props.hasActions && this.canAddReaction) {
            this.emojiPicker = useEmojiPicker(this.emojiPickerRef, {
                onSelect: (emoji) => {
                    const reaction = this.message.reactions.find(
                        ({ content, personas }) =>
                            content === emoji &&
                            personas.find((persona) => persona === this.store.self)
                    );
                    if (!reaction) {
                        this.messageService.react(this.message, emoji);
                    }
                },
            });
        }
        onMounted(() => {
            if (this.messageBody.el) {
                this.prepareMessageBody(this.messageBody.el);
            }
            if (this.shadowBody.el) {
                this.shadowRoot = this.shadowBody.el.attachShadow({ mode: "open" });
                const body = document.createElement("span");
                body.innerHTML = this.message.body;
                this.prepareMessageBody(body);
                const color =
                    this.env.services.cookie?.current.color_scheme === "dark" ? "white" : "black";
                this.shadowStyle = document.createElement("style");
                this.shadowStyle.innerHTML = `
                    * {
                        background-color: transparent !important;
                        color: ${color} !important;
                    }
                    a, a * {
                        color: ${this.constructor.SHADOW_LINK_COLOR} !important;
                    }
                    a:hover, a *:hover {
                        color: ${this.constructor.SHADOW_LINK_HOVER_COLOR} !important;
                    }
                `;
                this.shadowRoot.appendChild(this.shadowStyle);
                this.shadowRoot.appendChild(body);
            }
        });
    }

    get attClass() {
        return {
            "o-highlighted bg-view shadow-lg": this.props.highlighted,
            "o-selfAuthored": this.message.isSelfAuthored,
            "o-selected": this.props.messageToReplyTo?.isSelected(
                this.props.thread,
                this.props.message
            ),
            "o-squashed pb-1": this.props.squashed,
            "py-1": !this.props.squashed,
            "mt-2": !this.props.squashed && this.props.thread,
            "px-3": !this.props.isInChatWindow,
            "px-2": this.props.isInChatWindow,
            "opacity-50": this.props.messageToReplyTo?.isNotSelected(
                this.props.thread,
                this.props.message
            ),
        };
    }

    get authorAvatarAttClass() {
        return {
            o_object_fit_contain: this.props.message.author?.is_company,
            o_object_fit_cover: !this.props.message.author?.is_company,
        };
    }

    get authorAvatarUrl() {
        if (
            this.message.type === "email" &&
            !["partner", "guest"].includes(this.message.author?.type)
        ) {
            return url("/mail/static/src/img/email_icon.png");
        }
        return this.threadService.avatarUrl(this.message.author, this.props.message.originThread);
    }

    get expandText() {
        return _t("Expand");
    }

    get message() {
        return this.props.message;
    }

    get showSubtypeDescription() {
        return (
            this.message.subtypeDescription &&
            this.message.subtypeDescription.toLowerCase() !==
                htmlToTextContentInline(this.message.body || "").toLowerCase()
        );
    }

    get messageTypeText() {
        if (this.props.message.type === "notification") {
            return _t("System notification");
        }
        if (this.props.message.type === "auto_comment") {
            return _t("Automated message");
        }
        if (!this.props.message.isDiscussion && this.props.message.type !== "user_notification") {
            return _t("Note");
        }
        return _t("Message");
    }

    /**
     * @returns {boolean}
     */
    get canAddReaction() {
        return (
            this.message.originThread?.allowReactions &&
            Boolean(!this.message.isTransient && this.message.resId)
        );
    }

    get deletable() {
        return this.editable;
    }

    get editable() {
        if (!this.props.hasActions) {
            return false;
        }
        return this.message.editable;
    }

    get canReplyTo() {
        return this.message.originThread?.allowReplies && this.props.messageToReplyTo;
    }

    /**
     * @returns {boolean}
     */
    get canToggleStar() {
        return Boolean(!this.message.isTransient && this.message.resId && this.store.user);
    }

    get showUnfollow() {
        return Boolean(
            this.message.originThread?.selfFollower && this.props.thread?.model === "mail.box"
        );
    }

    get isActive() {
        return (
            this.state.isHovered ||
            this.state.isClicked ||
            this.emojiPicker?.isOpen ||
            this.state.expandOptions
        );
    }

    get isAlignedRight() {
        return Boolean(this.env.inChatWindow && this.props.message.isSelfAuthored);
    }

    get isOriginThread() {
        if (!this.props.thread) {
            return false;
        }
        return this.message.originThread === this.props.thread;
    }

    get isInInbox() {
        if (!this.props.thread) {
            return false;
        }
        return this.props.thread.id === "inbox";
    }

    onMouseenter() {
        this.state.isHovered = true;
    }

    onMouseleave() {
        this.state.isHovered = false;
        this.state.isClicked = null;
    }

    /**
     * @returns {boolean}
     */
    get shouldDisplayAuthorName() {
        if (!this.env.inChatWindow) {
            return true;
        }
        if (this.message.isSelfAuthored) {
            return false;
        }
        if (this.props.thread.type === "chat") {
            return false;
        }
        return true;
    }

    onClickDelete() {
        this.env.services.dialog.add(MessageConfirmDialog, {
            message: this.message,
            messageComponent: Message,
            prompt: _t("Are you sure you want to delete this message?"),
            onConfirm: () => this.messageService.delete(this.message),
        });
    }

    onClickReplyTo(ev) {
        this.props.messageToReplyTo.toggle(this.props.thread, this.props.message);
    }

    async onClickAttachmentUnlink(attachment) {
        await this.attachmentService.delete(attachment);
    }

    onClickMarkAsUnread() {
        const previousMessageId =
            this.message.originThread.getPreviousMessage(this.message)?.id ?? false;
        if (this.props.thread.seen_message_id === previousMessageId) {
            return;
        }
        return this.rpc("/discuss/channel/set_last_seen_message", {
            channel_id: this.message.originThread.id,
            last_message_id: previousMessageId,
            allow_older: true,
        });
    }

    get originalEmailText() {
        return this.state.originalEmail
            ? _t("Don't show Original Email")
            : _t("Show Original Email");
    }

    /**
     * @param {MouseEvent} ev
     */
    onClick(ev) {
        const model = ev.target.dataset.oeModel;
        const id = Number(ev.target.dataset.oeId);
        if (ev.target.closest(".o_channel_redirect")) {
            ev.preventDefault();
            const thread = this.threadService.insert({ model, id });
            this.threadService.open(thread);
            return;
        }
        if (ev.target.closest(".o_mail_redirect")) {
            ev.preventDefault();
            const partnerId = Number(ev.target.dataset.oeId);
            if (this.user.partnerId !== partnerId) {
                this.threadService.openChat({ partnerId });
            }
            return;
        }
        if (ev.target.tagName === "A") {
            if (model && id) {
                ev.preventDefault();
                this.env.services.action.doAction({
                    type: "ir.actions.act_window",
                    res_model: model,
                    views: [[false, "form"]],
                    res_id: id,
                });
            }
            return;
        }
        if (
            !isEventHandled(ev, "Message.ClickAuthor") &&
            !isEventHandled(ev, "Message.ClickFailure")
        ) {
            if (this.state.isClicked) {
                this.state.isClicked = false;
            } else {
                this.state.isClicked = true;
                document.body.addEventListener(
                    "click",
                    () => {
                        this.state.isClicked = false;
                    },
                    { capture: true, once: true }
                );
            }
        }
    }

    onClickEdit() {
        this.enterEditMode();
    }

    /**
     * @param {HTMLElement} element
     */
    prepareMessageBody(element) {}

    enterEditMode() {
        const messageContent = convertBrToLineBreak(this.props.message.body);
        this.threadService.insertComposer({
            mentions: this.props.message.recipients,
            message: this.props.message,
            textInputContent: messageContent,
            selection: {
                start: messageContent.length,
                end: messageContent.length,
                direction: "none",
            },
        });
        this.state.isEditing = true;
    }

    exitEditMode() {
        this.props.messageEdition?.exitEditMode();
        this.message.composer = null;
        this.state.isEditing = false;
    }

    onClickNotification(ev) {
        if (this.message.failureNotifications.length > 0) {
            this.onClickFailure(ev);
        } else {
            this.popover.open(ev.target, { message: this.message });
        }
    }

    onClickFailure(ev) {
        markEventHandled(ev, "Message.ClickFailure");
        this.env.services.action.doAction("mail.mail_resend_message_action", {
            additionalContext: {
                mail_message_to_resend: this.message.id,
            },
        });
    }

    openReactionMenu() {
        this.dialog.add(MessageReactionMenu, {
            message: this.props.message,
        });
    }
}
