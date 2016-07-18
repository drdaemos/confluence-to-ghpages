var cheerio = require('cheerio');
var _ = require('underscore');
var toMarkdown = require('to-markdown');
var path = require('path');
var utils = require('./utils');
var dateFormat = require('dateformat');

function convert(data, id) {
  var frontmatter = getFrontMatter(data, id);
  var data = preProcessData(data);
  var md = toMarkdown(data, {
    converters: [
      {
        filter: function(node) {
          return (node.nodeName === "PRE" && node.className.contains('Confluence'));
        },
        replacement: function(content) {
          return '{% highlight php %}{% raw %}\n' + content + '\n{% endraw %}{% endhighlight %}';
        }
      },
      {
        filter: function(node) {
          return (node.nodeName === "A" && node.getAttribute('href') && node.getAttribute('href').indexOf('http') !== 0 && node.getAttribute('href').indexOf('#') !== 0 && node.getAttribute('href').indexOf('attachments') !== 0);
        },
        replacement: function(content, node) {
          return '{% link "' + content + '" ' + node.getAttribute('href') + ' %}';
        }
      },
      {
        filter: function(node) {
          return (node.nodeName === "DIV" && node.className.contains('codeContent'));
        },
        replacement: function(content) {
          return content;
        }
      },
      {
        filter: function(node) {
          return (node.nodeName === "DIV" && node.id === "main-header")
              || (node.nodeName === "DIV" && node.className.contains('page-metadata'))
              || (node.nodeName === "SECTION" && node.className.contains('footer-body'));
        },
        replacement: function(content) {
          return "";
        }
      },
      {
        filter: ['div', 'span'],
        replacement: function(content) {
          return content;
        }
      },
      {
        filter: ['input', 'form', 'style'],
        replacement: function(content) {
          return '';
        }
      }
    ]
  });

  var md = postProcessMarkdown(md);

  return frontmatter + '\n' + md;
}

function preProcessData(data) {
  $ = cheerio.load(data);

  // fix table of contents
  $(".toc-macro a").each(function() {
    var anchor = utils.convertToAnchor($(this).text());
    $(this).attr('href', '#' + anchor);
  });

  return $.html();
}

function getLastUpdateMark(data) {
  $ = cheerio.load(data);
  var re = /on\s*([\s\S]*?)\s*$/;

  var match = $('.page-metadata').text().match(re);
  var date = match !== null ? Date.parse(match[1]) : Date.now();

  return dateFormat(date, 'yyyy-mm-dd HH:MM');
}

function postProcessMarkdown(md) {
  // add / before image urls
  var re = /\!\[(.*)\]\((.*?)\)/g;
  var subst = '![$1]({{site.baseurl}}/$2)';

  return md.replace(re, subst);
}

function fixLinks(content, dictionary) {
  _.each(dictionary, function(item, index, list) {
    content = content.replace(item.oldLink, item.identifier);
  });

  return content;
}

function getCategories(data) {
  $ = cheerio.load(data);

  var nodes = $('#breadcrumbs li a').map(function(i, el) {
    return $(this).text();
  }).get();

  // Remove KB and Home
  return nodes.slice(2);
}

function getFilepath(data) {
  return getFilepathFor(getCategories(data));
}

function getFilename(data) {
  $ = cheerio.load(data);

  var match = $('#title-text').text().match(/(?:.*) : (.*)/);
  var title = null;

  if (match !== null) {
    title = match[1].trim();
  }

  return utils.sanitizeFilename(title);
}

function getFilepathFor(categories) {
  var categories = categories.map(function(item) {
    return utils.sanitizeFilename(item);
  });
  return path.join.apply(null, categories);
}

function getFrontMatter(data, id) {
  var template =
`---
identifier: %%identifier%%
updated_at: %%updated_at%%
layout: article_with_sidebar
lang: en
title: '%%title%%'
{&
categories:
  %%categories%%
&}
---

`;

  template = template.replace('%%updated_at%%', getLastUpdateMark(data));

  template = template.replace('%%identifier%%', id);

  var categories = getCategories(data);

  if (categories.length < 1) {
    template = template.replace('%%categories%%', '- home');
  } else {
    template = template.replace('%%categories%%', '- ' + categories[0]);
  }

  var match = data.match(/<span id="title-text">\s(?:.*) : (.*)\s/);
  if (match !== null) {
    template = template.replace('%%title%%', match[1].trim());
    template = postprocessFrontMatter(template, match[1].trim());
  }

  return template;
}

function postprocessFrontMatter(template, identifier) {
  var append = '';
  switch(identifier) {
    case 'Basics':
      append =
`categories:
  - home
order: 3
icon: sitemap
description: Understand what technologies and approaches used in the X-Cart core and learn how to achieve typical tasks`;
      break;

    case 'Changelog':
      append =
`categories:
  - home
order: 11
icon: announcement
description: Discover new features and bugfixes`;
      break;

    case 'Changing store logic':
      append =
`categories:
  - home
order: 4
icon: setting
description: Learn how to adapt the X-Cart workflow and enlarge possibilities for your customers`;
      break;

    case 'Customization examples':
      append =
`categories:
  - home
order: 5
icon: pencil square o
description: Take a look at some of the customizations, made for our clients`;
      break;

    case 'Design changes':
      append =
`categories:
  - home
order: 3
icon: paint brush
description: Learn how to make your X-Cart store eye pretty. Discover design patterns for making X-Cart themes.`;
      break;

    case 'Drafts':
      append =
`categories: []`;
      break;

    case 'Getting started':
      append =
`categories:
  - home
order: 1
icon: rocket
description: Start developing for X-Cart without any hassle. Speed up your work process with X-Cart SDK`;
      break;

    case 'How-To Articles':
      append =
`categories:
  - home
order: 5
icon: info circle
description: Study different guides to achieve features that you need`;
      break;

    case 'Migration guides':
      append =
`categories:
  - home
order: 5
icon: retweet
description: Get a grip on the process of migrating your shopping cart and customization modules.`;
      break;

    case 'Setting up X-Cart 5 environment':
      append =
`categories:
  - home
order: 9
icon: server
description: Discover how to setup an environment for your X-Cart store`;
      break;

    case 'Webinars and video tutorials':
      append =
`categories:
  - home
order: 10
icon: youtube play
description: Live video from our developers and associates`;
      break;

    default:
      append = '$1';
      break;
  }

  if (append !== null) {
    var re = /{&\s*([\S\s]*)\s*&}/i;

    template = template.replace(re, append);
  }

  return template;
}

exports.convert = convert;
exports.getFrontMatter = getFrontMatter;
exports.getFilepath = getFilepath;
exports.getCategories = getCategories;
exports.getFilename = getFilename;
exports.fixLinks = fixLinks;