"""
@file emaillabs_backend.py
@description Anymail e-mail backend for EmailLabs (Vercom S.A.), speaking their
             v2.1 JSON API at api.emaillabs.io.

             THE ONLY HAND-WRITTEN ESP INTEGRATION IN THE PROJECT. Every other
             provider Anymail supports arrives as upstream code exercised by
             thousands of installs; EmailLabs has no Anymail backend, so this
             module is the price of sending from a Polish provider. It is
             deliberately small and deliberately boring: it maps the message
             Anymail hands it onto one JSON POST and does not attempt any
             feature the send path does not already use.

             THERE ARE TWO EMAILLABS APIS AND THEY SHARE ALMOST NOTHING. The
             older one (api.emaillabs.net.pl/api/new_sendmail) takes
             form-encoded fields and HTTP basic auth; this one takes JSON and
             two custom headers. An account created in the NEW panel can only
             use this one — the old host answers its keys with 401 "App Key is
             invalid", which reads as a bad credential and is not one. That is
             also why the panel labels the two secrets "Application-Key" and
             "Authorization": those are header names, not a username and a
             password.

             Its companion is `emaillabs_webhook.py`. The two halves are one
             vendor contract — this one states what we send, that one states
             what comes back — and neither is complete without the other, since
             the suppression ledger depends on the events.
@architecture Enterprise SaaS 2026
@module notifications/emaillabs_backend
"""
from __future__ import annotations

import base64
import json
from typing import Any

from anymail.backends.base_requests import (  # type: ignore[import-untyped]
    AnymailRequestsBackend,
    RequestsPayload,
)
from anymail.exceptions import AnymailRequestsAPIError  # type: ignore[import-untyped]
from anymail.message import AnymailRecipientStatus  # type: ignore[import-untyped]
from anymail.utils import Attachment, EmailAddress, get_anymail_setting  # type: ignore[import-untyped]

# Their schema constrains every display name to 2-64 characters and rejects the
# message outright when one falls short — so a name that cannot be sent is dropped
# rather than allowed to fail an entire send over a salutation.
_NAME_MIN_LENGTH = 2
_NAME_MAX_LENGTH = 64


def _person(address: EmailAddress) -> dict[str, str]:
    """One `{email, name}` object, with the name omitted when it cannot be carried."""
    person = {"email": address.addr_spec}
    name = (address.display_name or "").strip()
    if _NAME_MIN_LENGTH <= len(name) <= _NAME_MAX_LENGTH:
        person["name"] = name
    return person


class EmailBackend(AnymailRequestsBackend):
    """EmailLabs (emaillabs.io) v2.1 API backend."""

    esp_name = "EmailLabs"

    def __init__(self, **kwargs: Any) -> None:
        esp_name = self.esp_name
        # The panel calls these "Application-Key" and "Authorization" because that is
        # what they are: two headers. Neither is a username.
        self.app_key: str = get_anymail_setting("app_key", esp_name=esp_name, kwargs=kwargs)
        self.secret_key: str = get_anymail_setting("secret_key", esp_name=esp_name, kwargs=kwargs)
        # The sending identity inside the account, e.g. "1.voctensemble.smtp". It never
        # appears in the delivered message — the reader sees `from` — but it selects the
        # IP pool, which is why EmailLabs types an account as transactional or marketing.
        # Required by the API on every message; a message may override it via `esp_extra`.
        self.smtp_account: str = get_anymail_setting(
            "smtp_account", esp_name=esp_name, kwargs=kwargs,
        )
        # Overridable so an account still living on the OLD panel can be pointed back at
        # its own host without a code change — the two APIs are not interchangeable, but
        # which one an account belongs to is a property of the account, not of this code.
        api_url: str = get_anymail_setting(
            "api_url", esp_name=esp_name, kwargs=kwargs,
            default="https://api.emaillabs.io/",
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

        ANY `errors` ENTRY IS A FAILED SEND HERE, including the partial success their
        207 describes. This project sends one recipient per message, so "some of them
        went" is not a state that can arise — and treating a 207 as success would report
        an unsent notification as delivered, the one error this method exists to prevent.

        `meta.uniqId` is carried into the exception because it is what their support
        looks a request up by; without it a rejected send is unanswerable.
        """
        raw = self.deserialize_json_response(response, payload, message)
        parsed: dict[str, Any] = raw if isinstance(raw, dict) else {}
        meta_raw = parsed.get("meta")
        meta: dict[str, Any] = meta_raw if isinstance(meta_raw, dict) else {}
        errors = parsed.get("errors") or []

        if errors:
            detail = "; ".join(
                str(error.get("message") or error) for error in errors if error
            )
            raise AnymailRequestsAPIError(
                f"EmailLabs rejected the message (uniqId={meta.get('uniqId')!r}): {detail}",
                email_message=message,
                payload=payload,
                response=response,
                backend=self,
            )

        # `data` is per recipient and carries the id every later delivery report is
        # keyed by, so it is read from the response rather than echoed from the request.
        statuses: dict[str, AnymailRecipientStatus] = {}
        for item in parsed.get("data") or []:
            recipient = item.get("to") if isinstance(item, dict) else None
            if not isinstance(recipient, dict):
                continue
            email = str(recipient.get("email") or "").strip()
            if email:
                statuses[email] = AnymailRecipientStatus(
                    message_id=recipient.get("messageId"), status="queued",
                )

        # A response that named nobody still accepted the message; fall back on what we
        # asked for rather than returning an empty map Anymail would read as "no sends".
        for address in payload.to_recipients:
            statuses.setdefault(
                address.addr_spec, AnymailRecipientStatus(message_id=None, status="queued"),
            )
        return statuses


class EmailLabsPayload(RequestsPayload):
    """Builds the JSON body `POST /v2.1/email` expects."""

    def __init__(self, message: Any, defaults: Any, backend: EmailBackend, **kwargs: Any) -> None:
        self.to_recipients: list[EmailAddress] = []
        http_headers = kwargs.pop("headers", {})
        http_headers["Content-Type"] = "application/json"
        http_headers["Accept"] = "application/json"
        # The whole of the authentication: two API-key headers, no basic auth. Sending
        # these as a username/password pair instead is what the old API wanted, and it
        # fails here the same silent way it fails there.
        http_headers["Application-Key"] = backend.app_key
        http_headers["Authorization"] = backend.secret_key
        super().__init__(message, defaults, backend, headers=http_headers, **kwargs)

    def get_api_endpoint(self) -> str:
        return "v2.1/email"

    def init_payload(self) -> None:
        # `self.headers` is the HTTP request's own headers and `self.files` is what
        # requests would send as multipart — both belong to RequestsPayload. The
        # message's headers and attachments therefore need names of their own, or
        # they would overwrite the transport's.
        self.data: dict[str, Any] = {"smtpAccount": self.backend.smtp_account}
        self.content: dict[str, str] = {}
        self.mail_headers: dict[str, str] = {}

    def serialize_data(self) -> bytes:
        payload = dict(self.data)
        payload["to"] = [_person(recipient) for recipient in self.to_recipients]
        payload["content"] = self.content
        if self.mail_headers:
            payload["headers"] = self.mail_headers

        # BYTES, NOT STR, AND THE DIFFERENCE IS THE WHOLE MESSAGE. `requests` derives
        # Content-Length from `len()` of whatever this returns, and for a `str` that is
        # the number of CHARACTERS — while the body goes out as UTF-8, where every Polish
        # diacritic costs two bytes. The header then under-counts, the server reads only
        # that many bytes, and what arrives is truncated JSON: EmailLabs answers 400
        # "Empty request", naming a body it did in fact receive part of. Encoding here
        # makes the count the transport uses the count the transport sends.
        #
        # `ensure_ascii=False` is what makes that gap possible and is kept deliberately:
        # escaping every diacritic would inflate a Polish body for no reader's benefit.
        return json.dumps(payload, ensure_ascii=False).encode("utf-8")

    # ------------------------------------------------------------------ #
    # Anymail payload hooks                                              #
    # ------------------------------------------------------------------ #

    def set_from_email(self, email: EmailAddress) -> None:
        self.data["from"] = _person(email)

    def set_to(self, emails: list[EmailAddress]) -> None:
        self.to_recipients = list(emails)

    def set_cc(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["cc"] = [_person(address) for address in emails]

    def set_bcc(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["bcc"] = [_person(address) for address in emails]

    def set_subject(self, subject: str) -> None:
        self.data["subject"] = subject

    def set_reply_to(self, emails: list[EmailAddress]) -> None:
        if emails:
            self.data["replyTo"] = _person(emails[0])
        if len(emails) > 1:
            # Their schema takes a single object, not a list.
            self.unsupported_feature("multiple reply_to addresses")

    def set_extra_headers(self, headers: dict[str, str]) -> None:
        # This is what carries List-Unsubscribe and List-Unsubscribe-Post, which the
        # concert notice list's one-click withdrawal depends on (RFC 8058).
        self.mail_headers.update({str(name): str(value) for name, value in headers.items()})

    def set_text_body(self, body: str) -> None:
        self.content["text"] = body

    def set_html_body(self, body: str) -> None:
        self.content["html"] = body

    def add_attachment(self, attachment: Attachment) -> None:
        content = attachment.content
        if isinstance(content, str):
            content = content.encode("utf-8")
        self.data.setdefault("attachments", []).append({
            "fileName": attachment.name or "attachment",
            # The full media type is passed through unchanged, parameters included:
            # the schedule attachment is sent as `text/calendar; method=PUBLISH`, and
            # trimming that to the bare type would change how calendar clients treat it.
            "fileMime": attachment.mimetype or "application/octet-stream",
            "fileContent": base64.b64encode(content).decode("ascii"),
            "inline": bool(attachment.inline),
        })

    def set_tags(self, tags: list[str]) -> None:
        self.data["tags"] = list(tags)

    def set_esp_extra(self, extra: dict[str, Any]) -> None:
        """
        Merge raw API parameters, which is how a message picks a different
        `smtpAccount` — the escape hatch for routing bulk mail onto a marketing
        sending identity while the panel's own mail stays on a transactional one.
        """
        self.data.update(extra)
