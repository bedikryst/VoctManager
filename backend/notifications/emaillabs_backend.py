"""
@file emaillabs_backend.py
@description Anymail e-mail backend for EmailLabs (Vercom S.A.).

             THE ONLY HAND-WRITTEN ESP INTEGRATION IN THE PROJECT. Every other
             provider Anymail supports arrives as upstream code exercised by
             thousands of installs; EmailLabs has no Anymail backend, so this
             module is the price of sending from a Polish provider. It is
             deliberately small and deliberately boring: it maps the message
             Anymail hands it onto a form-encoded POST and does not attempt any
             feature the send path does not already use.

             Its companion is `emaillabs_webhook.py`. The two halves are one
             vendor contract — this one states what we send, that one states
             what comes back — and neither is complete without the other, since
             the suppression ledger depends on the events.
@architecture Enterprise SaaS 2026
@module notifications/emaillabs_backend
"""
from __future__ import annotations

import base64
from typing import Any
from urllib.parse import urlencode

from anymail.backends.base_requests import (  # type: ignore[import-untyped]
    AnymailRequestsBackend,
    RequestsPayload,
)
from anymail.exceptions import AnymailRequestsAPIError  # type: ignore[import-untyped]
from anymail.message import AnymailRecipientStatus  # type: ignore[import-untyped]
from anymail.utils import Attachment, EmailAddress, get_anymail_setting  # type: ignore[import-untyped]

# EmailLabs answers 200 OK and puts the real verdict in the body's `code`, so an
# HTTP-level check alone would call a rejected send a success.
_HTTP_SUCCESS = range(200, 300)


class EmailBackend(AnymailRequestsBackend):
    """EmailLabs (emaillabs.io) transactional API backend."""

    esp_name = "EmailLabs"

    def __init__(self, **kwargs: Any) -> None:
        esp_name = self.esp_name
        self.app_key: str = get_anymail_setting("app_key", esp_name=esp_name, kwargs=kwargs)
        self.secret_key: str = get_anymail_setting("secret_key", esp_name=esp_name, kwargs=kwargs)
        # The sending identity inside the account, e.g. "1.voctensemble.smtp". It never
        # appears in the delivered message — the reader sees `from`/`from_name` — but it
        # selects the IP pool, which is why EmailLabs types an account as transactional
        # or marketing. A message may override it through `esp_extra`.
        self.smtp_account: str = get_anymail_setting(
            "smtp_account", esp_name=esp_name, kwargs=kwargs,
        )
        api_url: str = get_anymail_setting(
            "api_url", esp_name=esp_name, kwargs=kwargs,
            default="https://api.emaillabs.net.pl/api/",
        )
        if not api_url.endswith("/"):
            api_url += "/"
        super().__init__(api_url, **kwargs)

    def build_message_payload(self, message: Any, defaults: Any) -> EmailLabsPayload:
        return EmailLabsPayload(message, defaults, self)

    def parse_recipient_status(
        self, response: Any, payload: EmailLabsPayload, message: Any,
    ) -> dict[str, AnymailRecipientStatus]:
        """
        Report every recipient as queued, or raise.

        The response body is not documented field-by-field, and this deliberately
        does not pretend otherwise: it checks the one field whose meaning is
        stated (`code`) and takes `req_id` as the message id when present. Parsing
        further would be inventing a contract, and a wrong guess here would report
        a failed send as delivered — the one error this method exists to prevent.
        """
        parsed = self.deserialize_json_response(response, payload, message)

        code = parsed.get("code") if isinstance(parsed, dict) else None
        if code is not None:
            try:
                accepted = int(code) in _HTTP_SUCCESS
            except (TypeError, ValueError):
                accepted = False
            if not accepted:
                raise AnymailRequestsAPIError(
                    f"EmailLabs rejected the message (code={code!r})",
                    email_message=message,
                    payload=payload,
                    response=response,
                    backend=self,
                )

        message_id = parsed.get("req_id") if isinstance(parsed, dict) else None
        return {
            recipient.addr_spec: AnymailRecipientStatus(
                message_id=message_id, status="queued",
            )
            for recipient in payload.to_recipients
        }


class EmailLabsPayload(RequestsPayload):
    """Builds the form-encoded body `POST /api/new_sendmail` expects."""

    def __init__(self, message: Any, defaults: Any, backend: EmailBackend, **kwargs: Any) -> None:
        self.to_recipients: list[EmailAddress] = []
        http_headers = kwargs.pop("headers", {})
        http_headers["Content-Type"] = "application/x-www-form-urlencoded"
        http_headers["Accept"] = "application/json"
        super().__init__(
            message, defaults, backend,
            auth=(backend.app_key, backend.secret_key),
            headers=http_headers,
            **kwargs,
        )

    def get_api_endpoint(self) -> str:
        return "new_sendmail"

    def init_payload(self) -> None:
        # `self.headers` is the HTTP request's own headers and `self.files` is what
        # requests would send as multipart — both belong to RequestsPayload. The
        # message's headers and attachments therefore need names of their own, or
        # they would overwrite the transport's.
        self.data: dict[str, str] = {"smtp_account": self.backend.smtp_account}
        self.mail_headers: dict[str, str] = {}
        self.mail_tags: list[str] = []
        self.mail_files: list[Attachment] = []

    def serialize_data(self) -> str:
        """
        Flatten to PHP-style bracket keys — the shape their API reads.

        `urlencode` is given a list of pairs rather than a dict because the
        bracket keys repeat per recipient, per header and per attachment.
        """
        pairs: list[tuple[str, str]] = list(self.data.items())

        for recipient in self.to_recipients:
            # `reciver_name` is EmailLabs' own spelling. It is not a typo to fix:
            # corrected to `receiver_name` the field is silently ignored and every
            # recipient loses their display name.
            pairs.append((
                f"to[{recipient.addr_spec}][reciver_name]", recipient.display_name or "",
            ))

        for name, value in self.mail_headers.items():
            pairs.append((f"headers[{name}]", value))

        for index, tag in enumerate(self.mail_tags):
            pairs.append((f"tags[{index}]", tag))

        for index, attachment in enumerate(self.mail_files):
            content = attachment.content
            if isinstance(content, str):
                content = content.encode("utf-8")
            pairs.append((f"files[{index}][name]", attachment.name or f"attachment-{index}"))
            # The full media type is passed through unchanged, parameters included:
            # the schedule attachment is sent as `text/calendar; method=PUBLISH`, and
            # trimming that to the bare type would change how calendar clients treat
            # it. If their parser objects, it objects loudly on the first send.
            pairs.append((f"files[{index}][mime]", attachment.mimetype or "application/octet-stream"))
            pairs.append((f"files[{index}][content]", base64.b64encode(content).decode("ascii")))
            pairs.append((f"files[{index}][inline]", "1" if attachment.inline else "0"))

        return urlencode(pairs)

    # ------------------------------------------------------------------ #
    # Anymail payload hooks                                              #
    # ------------------------------------------------------------------ #

    def set_from_email(self, email: EmailAddress) -> None:
        self.data["from"] = email.addr_spec
        if email.display_name:
            self.data["from_name"] = email.display_name

    def set_to(self, emails: list[EmailAddress]) -> None:
        self.to_recipients = list(emails)

    def set_cc(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["cc"] = emails[0].addr_spec
            if emails[0].display_name:
                self.data["cc_name"] = emails[0].display_name
        if len(emails) > 1:
            # Their API takes one cc address plus one name, not a list.
            self.unsupported_feature("multiple cc addresses")

    def set_bcc(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["bcc"] = emails[0].addr_spec
            if emails[0].display_name:
                self.data["bcc_name"] = emails[0].display_name
        if len(emails) > 1:
            self.unsupported_feature("multiple bcc addresses")

    def set_subject(self, subject: str) -> None:
        self.data["subject"] = subject

    def set_reply_to(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["reply_to"] = emails[0].addr_spec
        if len(emails) > 1:
            self.unsupported_feature("multiple reply_to addresses")

    def set_extra_headers(self, headers: dict[str, str]) -> None:
        # This is what carries List-Unsubscribe and List-Unsubscribe-Post, which the
        # concert notice list's one-click withdrawal depends on (RFC 8058).
        self.mail_headers.update({str(name): str(value) for name, value in headers.items()})

    def set_text_body(self, body: str) -> None:
        self.data["text"] = body

    def set_html_body(self, body: str) -> None:
        self.data["html"] = body

    def add_attachment(self, attachment: Attachment) -> None:
        self.mail_files.append(attachment)

    def set_tags(self, tags: list[str]) -> None:
        self.mail_tags = list(tags)

    def set_esp_extra(self, extra: dict[str, Any]) -> None:
        """
        Merge raw API parameters, which is how a message picks a different
        `smtp_account` — the escape hatch for routing bulk mail onto a marketing
        sending identity while the panel's own mail stays on a transactional one.
        """
        self.data.update({str(key): str(value) for key, value in extra.items()})
