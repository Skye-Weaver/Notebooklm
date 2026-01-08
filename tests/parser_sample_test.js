const { parseBatchexecuteResponse } = require("../parser");

const sampleResponse = `)]}'

32884
[["wrb.fr","e3bVqc","[[[\"db438c36-0bb3-4da0-af27-65b24a1456b8\",[\"ef1456fa-cd43-4861-a7a7-f025028a855b\",[\"лесоустройство факты, filetype:PDF\",1],1,[[[\"http://lhi.vniilm.ru/PDF/2017/2/LHI_2017_02-01-Giryaev.pdf\",\"Теоретические основы лесоустройства и современное лесное законодательство - ЛЕСОХОЗЯЙСТВЕННАЯ ИНФОРМАЦИЯ\",\"Анализ связи между качеством лесоуправления и актуальностью данных.\",1],[\"https://bibliotekar.ru/5-lesoustroystvo/68.htm\",\"краткая история развития отечественного лесоустройства\",\"Краткая хронология становления отечественного лесоустройства с XVIII века.\",1],[\"https://dzen.ru/a/ZG8PqNXOwQODWgGY\",\"История лесоустройства | Рослесинфорг - Дзен\",\"Доступное описание лесоустройства как элемента государственной системы управления.\",1]],\"Этот список источников освещает ключевые аспекты лесоустройства в России, объединяя исторические факты, правовые нормы и современные цифровые технологии.\"],2],[1767833079,987473000],[1767833070,709131000]]]]",null,null,null,"generic"]]
56
[["di",313],["af.httprm",312,"-428133643402829621",3]]
27`;

const results = parseBatchexecuteResponse(sampleResponse);

if (!results.length) {
  throw new Error("Expected at least one parsed block from sample response");
}

const forestBlock = results.find(
  (block) => block.query === "лесоустройство факты, filetype:PDF"
);

if (!forestBlock) {
  throw new Error("Expected to find forest query block");
}

if (!forestBlock.links.length) {
  throw new Error("Expected links for forest query");
}

console.log("Sample parser test passed:", forestBlock.links.length, "links");
