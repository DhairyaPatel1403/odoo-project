# Part of Odoo. See LICENSE file for full copyright and licensing details.

import random

from odoo import models
from odoo.addons.mail.populate.mail_message import Message as MailMessage


class Message(models.Model):
    _inherit = "mail.message"
    _populate_dependencies = ["discuss.channel", "discuss.channel.member"] + MailMessage._populate_dependencies

    def _populate(self, size):
        res = super()._populate(size)
        channels = self.env["discuss.channel"].browse(self.env.registry.populated_models["discuss.channel"])
        messages = []
        for channel in channels.filtered(lambda channel: channel.channel_member_ids):
            for counter in range(random.randrange({"small": 100, "medium": 1000, "large": 10000}[size])):
                messages.append(
                    {
                        "body": f"message_body_{counter}",
                        "message_type": "comment",
                        "model": "discuss.channel",
                        "res_id": channel.id,
                        "author_id": random.choice(channel.channel_member_ids.partner_id).id,
                    }
                )
        return res + self.env["mail.message"].create(messages)
