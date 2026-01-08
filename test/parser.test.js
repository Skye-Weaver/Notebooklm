const assert = require("assert");
const { parseNotebookResponse } = require("../src/parser");

const SAMPLE_RESPONSE = String.raw`)]}'

32884
[["wrb.fr","e3bVqc","[[[\"db438c36-0bb3-4da0-af27-65b24a1456b8\",[\"ef1456fa-cd43-4861-a7a7-f025028a855b\",[\"лесоустройство факты, filetype:PDF\",1],1,[[[\"http://lhi.vniilm.ru/PDF/2017/2/LHI_2017_02-01-Giryaev.pdf\",\"Теоретические основы лесоустройства и современное лесное законодательство - ЛЕСОХОЗЯЙСТВЕННАЯ ИНФОРМАЦИЯ\",\"Анализ связи между качеством лесоуправления и актуальностью данных.\",1],[\"https://bibliotekar.ru/5-lesoustroystvo/68.htm\",\"краткая история развития отечественного лесоустройства\",\"Краткая хронология становления отечественного лесоустройства с XVIII века.\",1]]],\"Описание\"],2]]]]",null,null,null,"generic"]]
56
[["di",313],["af.httprm",312,"-428133643402829621",3]]
27
`;

const BLACKLIST_RESPONSE = String.raw`)]}'
["ignored",["Подробный анализ",1],[[["https://example.com","Example","Desc",1]]]]
`;

const results = parseNotebookResponse(SAMPLE_RESPONSE);
assert.ok(results.length >= 1, "Expected at least one parsed block");
assert.strictEqual(results[0].query, "лесоустройство факты, filetype:PDF");
assert.ok(results[0].links.length >= 2, "Expected links to be extracted");

const filtered = parseNotebookResponse(BLACKLIST_RESPONSE);
assert.strictEqual(filtered.length, 0, "Expected blacklist query to be ignored");

console.log("Parser tests passed.");
