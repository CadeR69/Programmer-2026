==/* NOTE: attributes do have other values some only one others a few*/==

***==<!DOCTYPE html> ===*** 
## Definition and Usage

*All HTML documents must start with a `<!DOCTYPE>` declaration.*

*The declaration is not an HTML tag. It is an "information" to the browser about what document type to expect.*

*In HTML 5, the declaration is simple:*

==Example:==
<!DOCTYPE html>  
<html>  
<head>  
<title>Title of the document</title>  
</head>  
  
<body>  
The content of the document......  
</body>  
  
</html>


***==html and /html tag==***

## Definition and Usage

The `<html>` tag represents the root of an HTML document.

The `<html>` tag is the container for all other HTML elements (except for the [<!DOCTYPE>](https://www.w3schools.com/tags/tag_doctype.asp) tag).

**Note:** You should always include the [lang](https://www.w3schools.com/tags/att_global_lang.asp) attribute inside the `<html>` tag, to declare the language of the Web page. This is meant to assist search engines and browsers.

==Example:==
<!DOCTYPE html>  
<html lang="en">  
<head>  
  <title>Title of the document</title>  
</head>  
<body>  
  
<h1>This is a heading</h1>  
<p>This is a paragraph.</p>  
  
</body>  
</html

***==head tag==***

## Definition and Usage

The `<head>` element is a container for metadata (data about data) and is placed between the <html> tag and the <body> tag.

Metadata is data about the HTML document. Metadata is not displayed.

Metadata typically define the document title, character set, styles, scripts, and other meta information.

The following elements can go inside the `<head>` element:

- [<title>](https://www.w3schools.com/tags/tag_title.asp) (required in every HTML document)
- [<style>]
- [<base>]
- [<link>]
- [<meta>](
- [<script>]
- [<noscript>]


%% ==Example:== %%

<!DOCTYPE html>  
<html lang="en">  
<head>  
  <title>Title of the document</title>  
</head>  
<body>  
  
<h1>This is a heading</h1>  
<p>This is a paragraph.</p>  
  
</body>  
</html>


html <meta> charset attribute

Definition and Usage

The `charset` attribute specifies the character encoding for the HTML document.

The HTML5 specification encourages web developers to use the UTF-8 character set, which covers almost all of the characters and symbols in the world!

Example:

<head>  
  <meta charset="UTF-8">  
</head>

html meta name attribute

The `name` attribute specifies the name for the metadata.

The `name` attribute specifies a name for the information/value of the `[content](https://www.w3schools.com/TAgs/att_meta_content.asp)` attribute.

**Note:** If the `http-equiv` attribute is set, the `name` attribute should not be set.

HTML5 introduced a method to let web designers take control over the viewport (the user's visible area of a web page), through the `<meta>` tag (See "Setting The Viewport" example below).

Controls the viewport (the user's visible area of a web page).  

The viewport varies with the device, and will be smaller on a mobile phone than on a computer screen.

You should include the following <meta> viewport element in all your web pages:

<meta name="viewport" content="width=device-width, initial-scale=1.0">

A <meta> viewport element gives the browser instructions on how to control the page's dimensions and scaling.

The width=device-width part sets the width of the page to follow the screen-width of the device (which will vary depending on the device).

The initial-scale=1.0 part sets the initial zoom level when the page is first loaded by the browser.

Here is an example of a web page _without_ the viewport meta tag, and the same web page _with_ the viewport meta tag:

Example:
<head>  
  <meta name="description" content="Free Web tutorials">  
  <meta name="keywords" content="HTML,CSS,JavaScript">  
  <meta name="author" content="John Doe">  
  <meta name="viewport" content="width=device-width, initial-scale=1.0">  
</head>



