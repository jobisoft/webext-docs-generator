export const mozilla_api = `The $NAME$ API is inherited from Firefox, and its primary documentation is maintained by Mozilla at $LINK$. Thunderbird implements only the subset of functions, events, and types listed here. The MDN pages may provide further details and examples, but they may also reference features that are not supported in Thunderbird.`

export const permission_header = `The following permissions influence the behavior of the API: depending on which permissions are requested, additional methods might be available, or certain data may be included in responses.`
export const permission_warning = `Request permissions only when needed. Unnecessary requests may result in rejection during ATN review.`

// TODO: Move these into an annotation.
export const permission_descriptions = {
    "*": "Grant access to some or all methods of the $NAME$ API.",

    "tabs": "Grant host permission to all active and inactive tabs, allowing to read <var>title</var>, <var>url</var> and <var>favIconUrl</var> properties, or to inject content scripts.",
    "activeTab": "Grant host permission to the currently active tab, allowing to read <var>title</var>, <var>url</var> and <var>favIconUrl</var> properties, or to inject content scripts.",

    "declarativeNetRequestWithHostAccess": "Allows blocking or upgrading requests to hosts for which host permissions have already been granted.",

    "menus.overrideContext": "Grant access to the :code:`menus.overrideContext()` method, hiding all default context menu entries and overriding the entire context menu.",

    "webRequestBlocking": "Allows to use the blocking features of the webRequest API. With this permission, listeners can synchronously modify or cancel requests before they are sent or before a response is delivered. Without it, listeners can only observe requests without blocking or altering them.",
}
