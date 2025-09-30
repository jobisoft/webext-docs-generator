.. container:: sticky-sidebar
  
  ≡ On this page
  
  * `Getting started`_
  * `Where to get help and more information`_

  .. include:: _includes/developer-resources.rst

{{TITLE}}

{{VERSION_NOTE}}

Getting started
===============

These documents assume you already have some familiarity with the WebExtension technology. If not, it is
highly recommended to start with the following pages:

* `Introduction to add-on development`__
* `Hello world Add-on tutorial`__

__ https://developer.thunderbird.net/add-ons/about-add-ons
__ https://developer.thunderbird.net/add-ons/hello-world-add-on

For any problems or feature requests please `file a bug`__.

__ https://bugzilla.mozilla.org/enter_bug.cgi?product=Thunderbird&component=Add-Ons%3A+Extensions+API

.. hint::

  In Thunderbird, all WebExtension API can be accessed through the *browser.\** namespace, as with Firefox,
  but also through the  *messenger.\** namespace, which is a better fit for Thunderbird.

.. important::

  WebExtension APIs are asynchronous, that is, they return a `Promise`__ object which resolves when
  ready. See `Using Promises`__ for more information about Promises.

__ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
__ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

The documentation for the APIs listed in the left side panel is generated automatically from
Thunderbird's schema files. The `webext-schemas <https://github.com/thunderbird/webext-annotated-schemas>`__
repository can be used to obtain a copy of the relevant files.

.. toctree::
  :hidden:
  :caption: WebExtension API reference
  
  {{API_LIST}}

Where to get help and more information
======================================

`Introduction to add-on development`__
  Find information about creating and updating extensions for Thunderbird. Includes getting-started-tutorials and a collection of helpful articles and guides.

`Add-on developer community`__
  Learn how to get in touch with other Thunderbird add-on developers, to ask questions and to share knowledge.
  
`Sample extensions`__ 
  A collection of MailExtensions, showing how to use Thunderbird WebExtension APIs.
  
`MDN sample extensions`__
  A collection of WebExtensions, showing how to use WebExtension APIs in Firefox. They probably won't work directly in Thunderbird, but they may provide hints on how to use some of the WebExtension APIs that Thunderbird inherited from Firefox.

`MDN WebExtension documentation`__
  Find general information about the WebExtensions API cross-browser technology used by Firefox and many Chromium-based browsers. Not all information listed there apply to Thunderbird.

__ https://developer.thunderbird.net/add-ons/
__ https://developer.thunderbird.net/add-ons/community
__ https://github.com/thunderbird/sample-extensions
__ https://github.com/mdn/webextensions-examples
__ https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
