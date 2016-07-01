var cheerio = require('cheerio');
var toMarkdown = require('to-markdown');
var path = require('path');
var utils = require('./utils');

function convert(data) {
  var frontmatter = getFrontMatter(data);
  var md = toMarkdown(data, {
    converters: [
      {
        filter: function(node) {
          return (node.nodeName === "PRE" && node.className.contains('Confluence'));
        },
        replacement: function(content) {
          return content;
        }
      },
      {
        filter: function(node) {
          return (node.nodeName === "DIV" && node.className.contains('codeContent'));
        },
        replacement: function(content) {
          return '{% highlight php %}' + content + '{% endhighlight %}';
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

function postProcessMarkdown(md) {
  // add / before image urls
  var re = /\!\[(.*)\]\((.*)\)/g;
  var subst = '![$1]({{ site.baseurl }}/$2)';

  return md.replace(re, subst);
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

function getFrontMatter(data) {
  var template =
`---
layout: article_with_sidebar
lang: en
title: '%%title%%'
categories: %%categories%%
---
`;

  var categories = getCategories(data);

  if (categories.length < 1) {
    template = template.replace('%%categories%%', '[home]');
  } else {
    template = template.replace('%%categories%%', '[' + utils.sanitizeFilename(categories[0]) + ']');
  }

  var match = data.match(/<span id="title-text">\s(?:.*) : (.*)\s/);
  if (match !== null) {
    template = template.replace('%%title%%', match[1].trim());
  }

  return template;
}

exports.convert = convert;
exports.getFrontMatter = getFrontMatter;
exports.getFilepath = getFilepath;
exports.getCategories = getCategories;
exports.getFilename = getFilename;