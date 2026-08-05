import createDOMPurify from "dompurify";

const DOMPurify = createDOMPurify(window);
DOMPurify.setConfig({
  // data-cite-idx / data-cite-num：NotebookLM 风格内联来源标注
  ADD_ATTR: ["target", "rel", "data-cite-idx", "data-cite-num", "type", "class"],
  ADD_TAGS: ["button", "mark"],
});

export default DOMPurify;
