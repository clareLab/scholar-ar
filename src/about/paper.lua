local function latex(inlines)
  return pandoc.write(pandoc.Pandoc({ pandoc.Plain(inlines) }), "latex"):gsub("\n$", "")
end

local function cite(el)
  local keys, out = {}, {}
  for _, c in ipairs(el.citations) do
    local fig = c.id:match("^fig:(.+)$")
    if fig then
      table.insert(out, pandoc.RawInline("latex", "\\hyperref[fig:" .. fig .. "]{\\figurename~\\ref*{fig:" .. fig .. "}}"))
    else
      table.insert(keys, c.id)
    end
  end
  if #keys > 0 then
    table.insert(out, pandoc.RawInline("latex", "\\cite{" .. table.concat(keys, ",") .. "}"))
  end
  return out
end

local function figure(div)
  local id = div.identifier:match("^fig:(.+)$")
  local caption = pandoc.utils.blocks_to_inlines(div.content)
  return pandoc.RawBlock(
    "latex",
    "\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=\\textwidth]{"
      .. id
      .. ".pdf}\n\\caption{"
      .. latex(caption)
      .. "}\\label{fig:"
      .. id
      .. "}\n\\end{figure}"
  )
end

local function references(div)
  local items = {}
  for _, block in ipairs(div.content) do
    local inlines = block.content
    local key = pandoc.utils.stringify(inlines[1]):match("^%[(.+)%]$")
    table.remove(inlines, 1)
    if inlines[1] and inlines[1].t == "Space" then
      table.remove(inlines, 1)
    end
    table.insert(items, "\\bibitem{" .. key .. "} " .. latex(inlines))
  end
  return pandoc.RawBlock(
    "latex",
    "\\FloatBarrier\n\\begin{thebibliography}{" .. #items .. "}\n" .. table.concat(items, "\n") .. "\n\\end{thebibliography}"
  )
end

local function unhead(doc)
  local out = {}
  for k, block in ipairs(doc.blocks) do
    local after = doc.blocks[k + 1]
    if not (block.t == "Header" and after and after.t == "Div" and after.identifier == "refs") then
      table.insert(out, block)
    end
  end
  doc.blocks = out
  return doc
end

return {
  { Pandoc = unhead },
  { Cite = cite },
  {
    Header = function(h)
      if h.level == 1 then
        return { pandoc.RawBlock("latex", "\\FloatBarrier"), h }
      end
    end,
    Div = function(div)
      if div.classes:includes("figure") then
        return figure(div)
      end
      if div.identifier == "refs" then
        return references(div)
      end
    end,
  },
}
