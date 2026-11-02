import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {plainText,readerText} from '../lib/text.ts';
import {parseFeed} from '../lib/feed.ts';
import {validateBackup} from '../lib/backup.ts';
test('RSS and Atom normalize numeric, CDATA, escaped and named feed text',()=>{
 const encoded='&#x3010;&#36895;&#x5831;&#x3011;';
 for(const content of [encoded,`<![CDATA[${encoded}]]>`,encoded.replaceAll('&','&amp;')]){
  for(const xml of [`<rss><channel><title>${content}</title><item><title>${content}</title><link>https://example.com/a</link><description>${content}</description></item></channel></rss>`,`<feed><title>${content}</title><entry><title>${content}</title><link href="https://example.com/a"/><summary>${content}</summary></entry></feed>`]){
   const r=parseFeed(xml,'https://example.com/feed');assert.equal(r.title,'【速報】');assert.equal(r.items[0].title,'【速報】');assert.equal(r.items[0].summary,'【速報】');
  }
 }
 assert.equal(plainText('A &amp; B&nbsp;&quot;C&quot; &mdash; &#x1F600;'),'A & B "C" — 😀');
 assert.equal(plainText('&#0; &#xD800; &#x110000;'),'� � �');
 assert.equal(plainText('&unknown; &#xZZ;'),'&unknown; &#xZZ;');
});
test('stored rows normalize without mutating reading state, identity, URLs or presets',()=>{
 const row={id:'a',feed:'f',title:'&#x901F;',summary:'&amp;#22577;',url:'https://example.com/?a=1&amp;b=2',read:1,saved:1,version:7};
 const input={feeds:[{id:'f',title:'&#x5A92;&#x4F53;'}],articles:[row],presets:[{name:'unchanged'}]};const before=JSON.stringify(input),out=readerText(input);
 assert.equal(out.feeds[0].title,'媒体');assert.equal(out.articles[0].title,'速');assert.equal(out.articles[0].summary,'報');
 assert.deepEqual({...out.articles[0],title:row.title,summary:row.summary},row);assert.equal(JSON.stringify(input),before);assert.deepEqual(readerText(out),out);
 const backup=validateBackup({format:'reading-room',version:1,feeds:[{id:'f',title:'&#x901F;',url:'https://example.com/feed'}],articles:[],presets:[]});assert.equal(backup.feeds[0].title,'速');
});
test('decoded malicious markup stays inert through the actual React text rendering model',()=>{
 for(const value of ['&lt;script&gt;alert(1)&lt;/script&gt;Hello','&amp;lt;img src=x onerror=alert(1)&amp;gt;Hello','<svg onload=alert(1)>Hello</svg>']){
  const plain=plainText(value);assert.equal(plain,'Hello');assert.equal(renderToStaticMarkup(createElement('p',null,plain)),'<p>Hello</p>');
 }
 const output=renderToStaticMarkup(createElement('p',null,plainText('&amp;amp;amp;lt;img src=x onerror=alert(1)&amp;amp;amp;gt;')));assert.ok(!output.includes('<img'));assert.ok(!output.includes('<script'));
});
