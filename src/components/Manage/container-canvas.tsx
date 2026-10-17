"use client";

import React from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconFolderUp,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { foldAway } from "@/components/motion";
import {
  blockAtPath,
  parsePath,
  canStep,
  insertAtPath,
  moveBlock,
  pathKey,
  removeAtPath,
  stepPath,
  type BlockPath,
} from "./block-tree";
import { DiscordFrame, ImageSlot, InlineText, LinkField, PartRoll, PartSheet, PartTools, SheetField, usePhone } from "./discord-message";
import {
  AccentSwatches,
  AddBlockMenu,
  ButtonRowBody,
  CONTAINER_ADDERS,
  CONTAINER_ADDER_LABELS,
  CONTAINER_LIMITS,
  DcBlockView,
  MediaGalleryBody,
  MessageDropdownBody,
  PreviewButton,
  RowButtonEditor,
  SeparatorBody,
  SystemButtonBody,
  accentHex,
  containerCharacterCount,
  countContainerComponents,
  duplicateBlock,
  ensureBlockIds,
  layoutHasSystemButton,
  toEditorLayout,
  useButtonTargets,
  type ContainerBlock,
  type SystemComponentPreview,
} from "./message-design";

/**
 * A components message, edited where it is read, on the mockup builder's
 * Discord surface. Pressing a block makes it the active one: its text is typed
 * in place, its picture is dropped on it, and anything else (a button's target,
 * a gallery's links, a separator's spacing) opens under it in the dashboard's
 * controls. Its bar names it and moves, copies or removes it. New blocks are
 * added with the `+` at the foot of the message or any container, or under the
 * active block.
 */
export function ContainerCanvas({
  blocks: stored,
  explicitLayout,
  onChange,
  fallbackColor = "none",
  content,
  onContent,
  systemButtons,
}: {
  blocks: ContainerBlock[];
  explicitLayout: boolean;
  /** The next layout. The caller marks it explicit when it saves it. */
  onChange: (next: ContainerBlock[]) => void;
  /** The message's own accent, which a container without one of its own
   *  inherits (see toEditorLayout). */
  fallbackColor?: string;
  content?: string;
  onContent?: (next: string) => void;
  systemButtons?: SystemComponentPreview[];
}) {
  const layout = React.useMemo(() => toEditorLayout(stored, explicitLayout), [stored, explicitLayout]);
  const [active, setActive] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const phone = usePhone();
  const host = React.useRef<HTMLDivElement | null>(null);
  const close = React.useCallback(() => {
    setActive(null);
    setEditing(null);
  }, []);
  const targets = useButtonTargets();
  const componentCount = countContainerComponents(layout);
  const characters = containerCharacterCount(layout);
  const placed = layoutHasSystemButton(layout);
  const full = componentCount >= CONTAINER_LIMITS.blocks;

  /* Blocks added after the canvas opened arrive; the ones it opened with are
     simply there. */
  const known = React.useRef<Set<string> | null>(null);
  const arrived = React.useRef(new Set<string>());
  React.useMemo(() => {
    const ids = new Set<string>();
    const walk = (list: ContainerBlock[]) =>
      list.forEach((block) => {
        if (block.id) ids.add(block.id);
        if (block.blocks) walk(block.blocks);
      });
    walk(layout);
    if (known.current) for (const id of ids) if (!known.current.has(id)) arrived.current.add(id);
    known.current = ids;
  }, [layout]);

  React.useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("[data-block], .gw-cv-tools, .gw-cc-bar, .gw-psheet-layer")) return;
      if (
        target.closest(
          ".gw-md-bar, .gw-md-vars, .gw-vac, [data-md-keep], .gw-menu, [role='listbox'], [role='dialog'], [data-radix-popper-content-wrapper]",
        )
      )
        return;
      setActive(null);
      setEditing(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active]);

  const write = (next: ContainerBlock[]) => onChange(ensureBlockIds(next));
  const patchAt = (path: BlockPath, patch: Partial<ContainerBlock>) => {
    const update = (list: ContainerBlock[], depth: number): ContainerBlock[] =>
      list.map((block, index) => {
        if (index !== path[depth]) return block;
        if (depth === path.length - 1) return { ...block, ...patch };
        return { ...block, blocks: update(block.blocks || [], depth + 1) };
      });
    write(update(layout, 0));
  };
  const add = (parent: BlockPath, index: number, type: string) => {
    const adder = CONTAINER_ADDERS.find((entry) => entry.type === type);
    if (!adder) return;
    const block = type === "system_button" ? ({ type: "system_button" } as ContainerBlock) : adder.make();
    const at = [...parent, index];
    write(insertAtPath(layout, at, block));
    setActive(pathKey(at));
    setEditing(block.type === "text" || block.type === "section" || block.type === "text_button" ? pathKey(at) : null);
  };
  const addSystem = (parent: BlockPath, index: number) => {
    const at = [...parent, index];
    write(insertAtPath(layout, at, { type: "system_button" } as ContainerBlock));
    setActive(pathKey(at));
  };

  /* A block's sheet, on a phone: what it says at a size you can type into,
     what else it has, and what can be done to it, as buttons you can hit. */
  const sheetTitle = (key: string | null) => {
    if (!key) return "";
    if (key === "content") return "Message";
    const path = parsePath(key);
    const block = path ? blockAtPath(layout, path) : null;
    if (!block) return "";
    return block.type === "system_button" ? "Feature button" : CONTAINER_ADDER_LABELS[block.type] || block.type.replace(/_/g, " ");
  };
  const renderSheet = (key: string): React.ReactNode => {
    if (key === "content") {
      return onContent ? (
        <SheetField autoFocus label="Message" multiline limit={2000} value={content || ""} onChange={onContent} placeholder="Above the blocks" />
      ) : null;
    }
    const path = parsePath(key);
    const block = path ? blockAtPath(layout, path) : null;
    if (!path || !block) return null;
    const parent = path.slice(0, -1);
    const index = path[path.length - 1];
    const list = parent.length ? blockAtPath(layout, parent)?.blocks || [] : layout;
    const worded = block.type === "text" || block.type === "section" || block.type === "text_button";
    const move = (direction: 1 | -1) => {
      const to = stepPath(layout, path, direction);
      if (!to) return;
      write(moveBlock(layout, path, to));
      setActive(pathKey(to));
    };
    return (
      <>
        {worded ? (
          <SheetField
            autoFocus
            label="Text"
            multiline
            limit={CONTAINER_LIMITS.text}
            value={block.content || ""}
            onChange={(next) => patchAt(path, { content: next })}
            placeholder="Markdown, mentions and {variables} work."
          />
        ) : null}
        {block.type === "section" ? (
          <ImageSlot
            size="thumb"
            label="Thumbnail"
            className="gw-cc-thumb"
            imgClassName="dc-section-thumb"
            value={block.thumbnail_url || undefined}
            onChange={(thumbnail_url) => patchAt(path, { thumbnail_url: thumbnail_url || "" })}
            onLink={() => undefined}
          />
        ) : null}
        {block.type === "media_gallery" && (block.urls || []).length < CONTAINER_LIMITS.galleryItems ? (
          <ImageSlot
            label="Picture"
            className="gw-cc-gallery-add"
            onChange={(next) => (next ? patchAt(path, { urls: [...(block.urls || []), next] }) : undefined)}
            onLink={() => undefined}
          />
        ) : null}
        <BlockTools
          block={block}
          fallbackColor={fallbackColor}
          systemButtons={systemButtons}
          targets={targets}
          totalCount={componentCount}
          systemButtonPlaced={placed}
          previousType={list[index - 1]?.type}
          patch={(next) => patchAt(path, next)}
        />
        <div className="gw-psheet-acts">
          <button type="button" className="gw-btn" data-kind="ghost" disabled={!canStep(layout, path, -1)} onClick={() => move(-1)}>
            <IconArrowUp size={15} /> Up
          </button>
          <button type="button" className="gw-btn" data-kind="ghost" disabled={!canStep(layout, path, 1)} onClick={() => move(1)}>
            <IconArrowDown size={15} /> Down
          </button>
          <button
            type="button"
            className="gw-btn"
            data-kind="ghost"
            disabled={block.type === "system_button" || componentCount + countContainerComponents([block]) > CONTAINER_LIMITS.blocks}
            onClick={() => {
              write(insertAtPath(layout, [...parent, index + 1], duplicateBlock(block)));
              setActive(pathKey([...parent, index + 1]));
            }}
          >
            <IconCopy size={15} /> Copy
          </button>
          <AddBlockMenu
            nested={path.length > 1}
            disabled={full}
            onAdd={(type) => add(parent, index + 1, type)}
            trigger={
              <button type="button" className="gw-btn" data-kind="ghost" disabled={full}>
                <IconPlus size={15} /> Below
              </button>
            }
          />
          {block.type === "container" ? (
            <button
              type="button"
              className="gw-btn"
              data-kind="ghost"
              onClick={() => {
                let next = removeAtPath(layout, path).layout;
                (block.blocks || []).forEach((child, offset) => {
                  next = insertAtPath(next, [...parent, index + offset], child);
                });
                write(next);
                close();
              }}
            >
              <IconFolderUp size={15} /> Unbox
            </button>
          ) : null}
          <button
            type="button"
            className="gw-btn gw-psheet-remove"
            onClick={() => {
              close();
              write(removeAtPath(layout, path).layout);
            }}
          >
            <IconTrash size={15} /> Remove
          </button>
        </div>
      </>
    );
  };

  const render = (list: ContainerBlock[], parent: BlockPath, inContainer: boolean) => (
    <>
      {list.map((block, index) => {
        const path = [...parent, index];
        const key = pathKey(path);
        return (
          <BlockShell
            key={block.id || key}
            block={block}
            path={path}
            active={active === key}
            arrived={Boolean(block.id && arrived.current.has(block.id))}
            onActivate={() => {
              if (active !== key) {
                setActive(key);
                setEditing(null);
              }
            }}
            bar={
              phone ? null : <BlockBar
                block={block}
                canUp={canStep(layout, path, -1)}
                canDown={canStep(layout, path, 1)}
                canCopy={block.type !== "system_button" && componentCount + countContainerComponents([block]) <= CONTAINER_LIMITS.blocks}
                onUp={() => {
                  const to = stepPath(layout, path, -1);
                  if (to) {
                    write(moveBlock(layout, path, to));
                    setActive(pathKey(to));
                  }
                }}
                onDown={() => {
                  const to = stepPath(layout, path, 1);
                  if (to) {
                    write(moveBlock(layout, path, to));
                    setActive(pathKey(to));
                  }
                }}
                onCopy={() => {
                  const copy = duplicateBlock(block);
                  write(insertAtPath(layout, [...parent, index + 1], copy));
                  setActive(pathKey([...parent, index + 1]));
                }}
                onUnbox={
                  block.type === "container"
                    ? () => {
                        const { layout: without } = removeAtPath(layout, path);
                        let next = without;
                        (block.blocks || []).forEach((child, offset) => {
                          next = insertAtPath(next, [...parent, index + offset], child);
                        });
                        write(next);
                        setActive(null);
                      }
                    : undefined
                }
                onRemove={(node) => {
                  setActive(null);
                  foldAway(node, () => write(removeAtPath(layout, path).layout));
                }}
                addBelow={
                  <AddBlockMenu
                    nested={path.length > 1}
                    disabled={full}
                    onAdd={(type) => add(parent, index + 1, type)}
                    trigger={
                      <button type="button" className="gw-cc-bar-btn" aria-label="Add a block below" title="Add below" disabled={full}>
                        <IconPlus size={15} />
                      </button>
                    }
                  />
                }
              />
            }
            tools={
              phone ? null : <BlockTools
                block={block}
                fallbackColor={fallbackColor}
                systemButtons={systemButtons}
                targets={targets}
                totalCount={componentCount}
                systemButtonPlaced={placed}
                previousType={list[index - 1]?.type}
                patch={(next) => patchAt(path, next)}
              />
            }
          >
            <BlockBody
              block={block}
              path={path}
              inContainer={inContainer}
              editing={!phone && editing === key}
              onEdit={() => {
                setActive(key);
                setEditing(phone ? null : key);
              }}
              onDone={() => setEditing(null)}
              patch={(next) => patchAt(path, next)}
              fallbackColor={fallbackColor}
              systemButtons={systemButtons}
              onLink={() => setActive(key)}
            >
              {block.type === "container" ? (
                <>
                  {render(block.blocks || [], path, true)}
                  <AddRow
                    nested
                    empty={!(block.blocks || []).length}
                    disabled={full}
                    onAdd={(type) => add(path, (block.blocks || []).length, type)}
                    onPlace={systemButtons?.length && !placed ? () => addSystem(path, (block.blocks || []).length) : undefined}
                  />
                </>
              ) : null}
            </BlockBody>
          </BlockShell>
        );
      })}
    </>
  );

  return (
    <div className="gw-cv gw-cc" ref={host} data-phone={phone ? "true" : undefined}>
      <DiscordFrame className="gw-cv-chat">
        {onContent ? (
          <div className="dc-content" data-block>
            <InlineText
              value={content || ""}
              onChange={onContent}
              open={!phone && editing === "content"}
              onOpen={() => {
                setActive("content");
                setEditing(phone ? null : "content");
              }}
              onClose={() => setEditing(null)}
              placeholder="Add a message above the blocks"
              multiline
              limit={2000}
            />
          </div>
        ) : null}
        <div className="dc-blocks gw-cc-blocks">
          {render(layout, [], false)}
          <AddRow
            empty={!layout.length}
            disabled={full}
            onAdd={(type) => add([], layout.length, type)}
            onPlace={systemButtons?.length && !placed ? () => addSystem([], layout.length) : undefined}
          />
        </div>
      </DiscordFrame>
      <PartSheet host={host.current} open={phone && active !== null} title={sheetTitle(active)} onClose={close}>
        {phone && active ? renderSheet(active) : null}
      </PartSheet>
      <p className="gw-cv-hint">
        Press a block to change it. Type <kbd>{"{"}</kbd> for a variable.
        {componentCount > CONTAINER_LIMITS.blocks * 0.6 || characters > CONTAINER_LIMITS.total * 0.6 ? (
          <span
            className="gw-cv-count"
            data-tone={
              componentCount > CONTAINER_LIMITS.blocks || characters > CONTAINER_LIMITS.total
                ? "bad"
                : characters > CONTAINER_LIMITS.total * 0.9
                  ? "warn"
                  : undefined
            }
          >
            {componentCount}/{CONTAINER_LIMITS.blocks} blocks · {characters.toLocaleString()}/{CONTAINER_LIMITS.total.toLocaleString()}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/* ── one block: its place, its bar, its tools ──────────────────────────────── */

function BlockShell({
  block,
  path,
  active,
  arrived,
  onActivate,
  bar,
  tools,
  children,
}: {
  block: ContainerBlock;
  path: BlockPath;
  active: boolean;
  arrived: boolean;
  onActivate: () => void;
  bar: React.ReactNode;
  tools: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="gw-cc-block"
      data-block={pathKey(path)}
      data-type={block.type}
      data-active={active ? "true" : undefined}
      data-arrived={arrived ? "true" : undefined}
      onClick={(event) => {
        // The innermost block under the press is the one it meant.
        if ((event.target as Element).closest("[data-block]") !== event.currentTarget) return;
        onActivate();
      }}
    >
      {active ? bar : null}
      {children}
      {tools ? <PartRoll open={active}>{tools}</PartRoll> : null}
    </div>
  );
}

function BlockBar({
  block,
  canUp,
  canDown,
  canCopy,
  onUp,
  onDown,
  onCopy,
  onUnbox,
  onRemove,
  addBelow,
}: {
  block: ContainerBlock;
  canUp: boolean;
  canDown: boolean;
  canCopy: boolean;
  onUp: () => void;
  onDown: () => void;
  onCopy: () => void;
  onUnbox?: () => void;
  onRemove: (node: Element | null) => void;
  addBelow: React.ReactNode;
}) {
  const label =
    block.type === "system_button"
      ? "Feature button"
      : CONTAINER_ADDER_LABELS[block.type] || block.type.replace(/_/g, " ");
  return (
    <div className="gw-cc-bar" data-md-keep>
      <span className="gw-cc-bar-name">{label}</span>
      <span className="gw-cc-bar-acts">
        <button type="button" className="gw-cc-bar-btn" aria-label="Move up" title="Move up" disabled={!canUp} onClick={onUp}>
          <IconArrowUp size={15} />
        </button>
        <button type="button" className="gw-cc-bar-btn" aria-label="Move down" title="Move down" disabled={!canDown} onClick={onDown}>
          <IconArrowDown size={15} />
        </button>
        <button type="button" className="gw-cc-bar-btn" aria-label="Duplicate" title="Duplicate" disabled={!canCopy} onClick={onCopy}>
          <IconCopy size={15} />
        </button>
        {addBelow}
        {onUnbox ? (
          <button type="button" className="gw-cc-bar-btn" aria-label="Take the box off, keep its blocks" title="Take the box off, keep its blocks" onClick={onUnbox}>
            <IconFolderUp size={15} />
          </button>
        ) : null}
        <button
          type="button"
          className="gw-cc-bar-btn"
          data-tone="bad"
          aria-label={block.type === "container" ? "Remove the container and everything in it" : "Remove"}
          title="Remove"
          onClick={(event) => onRemove(event.currentTarget.closest("[data-block]"))}
        >
          <IconTrash size={15} />
        </button>
      </span>
    </div>
  );
}

/** A block as Discord draws it, with the parts that are typed or dropped
 *  onto made live. Everything else is drawn by the preview's own renderer. */
function BlockBody({
  block,
  inContainer,
  editing,
  onEdit,
  onDone,
  patch,
  fallbackColor,
  systemButtons,
  onLink,
  children,
}: {
  block: ContainerBlock;
  path: BlockPath;
  inContainer: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  patch: (next: Partial<ContainerBlock>) => void;
  fallbackColor: string;
  systemButtons?: SystemComponentPreview[];
  onLink: () => void;
  children?: React.ReactNode;
}) {
  const size = inContainer ? "small" : undefined;
  const text = (
    <InlineText
      value={block.content || ""}
      onChange={(content) => patch({ content })}
      open={editing}
      onOpen={onEdit}
      onClose={onDone}
      placeholder={block.type === "text" ? "Write something. Markdown and {variables} work." : "Text beside it"}
      multiline
      limit={CONTAINER_LIMITS.text}
    />
  );
  if (block.type === "text") {
    return (
      <div className="dc-text-display" data-size={size}>
        {text}
      </div>
    );
  }
  if (block.type === "section") {
    return (
      <div className="dc-section">
        <div className="dc-section-text dc-text-display" data-size={size}>
          {text}
        </div>
        <ImageSlot
          size="thumb"
          label="Thumbnail"
          className="gw-cc-thumb"
          imgClassName="dc-section-thumb"
          value={block.thumbnail_url || undefined}
          onChange={(thumbnail_url) => patch({ thumbnail_url: thumbnail_url || "" })}
          onLink={onLink}
        />
      </div>
    );
  }
  if (block.type === "text_button") {
    return (
      <div className="dc-section">
        <div className="dc-section-text dc-text-display" data-size={size}>
          {text}
        </div>
        {block.button ? (
          <PreviewButton button={block.button} />
        ) : (
          <span className="dc-btn gw-cc-ghost-btn" data-style="secondary">
            Button
          </span>
        )}
      </div>
    );
  }
  if (block.type === "media_gallery") {
    const urls = (block.urls || []).slice(0, CONTAINER_LIMITS.galleryItems);
    return (
      <div className="gw-cc-gallery">
        {urls.length ? (
          <div className="dc-gallery" data-count={urls.length > 4 ? "many" : String(urls.length)}>
            {urls.map((url, index) => (
              <div key={index} className="dc-gallery-cell">
                <ImageSlot
                  label="Picture"
                  value={url || undefined}
                  onChange={(next) =>
                    patch({
                      urls: next
                        ? urls.map((item, i) => (i === index ? next : item))
                        : urls.filter((_, i) => i !== index),
                    })
                  }
                  onLink={onLink}
                />
              </div>
            ))}
          </div>
        ) : null}
        {urls.length < CONTAINER_LIMITS.galleryItems ? (
          <ImageSlot
            label={urls.length ? "Another picture" : "Picture"}
            className="gw-cc-gallery-add"
            onChange={(next) => (next ? patch({ urls: [...urls, next] }) : undefined)}
            onLink={onLink}
          />
        ) : null}
      </div>
    );
  }
  if (block.type === "container") {
    const accent = accentHex(block.color || fallbackColor);
    return (
      <div
        className="dc-container"
        data-accent={accent ? undefined : "none"}
        style={{ ["--container-accent" as string]: accent || undefined }}
      >
        <div className="dc-container-inner">{children}</div>
      </div>
    );
  }
  return <DcBlockView block={block} systemButtons={systemButtons} fallbackColor={fallbackColor} inContainer={inContainer} />;
}

/** What a block has besides what is typed or dropped onto it. */
function BlockTools({
  block,
  fallbackColor,
  systemButtons,
  targets,
  totalCount,
  systemButtonPlaced,
  previousType,
  patch,
}: {
  block: ContainerBlock;
  fallbackColor: string;
  systemButtons?: SystemComponentPreview[];
  targets: ReturnType<typeof useButtonTargets>;
  totalCount: number;
  systemButtonPlaced: boolean;
  previousType?: string;
  patch: (next: Partial<ContainerBlock>) => void;
}) {
  const props = { block, patch, targets, systemButtons, totalCount, systemButtonPlaced, previousType };
  let body: React.ReactNode = null;
  switch (block.type) {
    case "section":
      body = (
        <LinkField
          picture
          label="Thumbnail link"
          value={block.thumbnail_url || undefined}
          onChange={(thumbnail_url) => patch({ thumbnail_url: thumbnail_url || "" })}
        />
      );
      break;
    case "text_button":
      body = block.button ? (
        <RowButtonEditor
          button={block.button}
          targets={targets}
          onChange={(next) => patch({ button: next })}
          onRemove={() => patch({ button: null })}
        />
      ) : (
        <button type="button" className="gw-btn" onClick={() => patch({ button: { type: "link", label: "", url: "" } })}>
          <IconPlus size={13} />
          Attach a button
        </button>
      );
      break;
    case "separator":
      body = <SeparatorBody {...props} />;
      break;
    case "media_gallery":
      body = <MediaGalleryBody {...props} />;
      break;
    case "button_row":
      body = <ButtonRowBody {...props} />;
      break;
    case "message_dropdown":
      body = <MessageDropdownBody {...props} />;
      break;
    case "system_button":
      body = <SystemButtonBody {...props} />;
      break;
    case "container":
      body = (
        <div className="gw-cv-field">
          <span className="gw-cv-label">Accent</span>
          <AccentSwatches
            value={block.color || fallbackColor || "none"}
            onChange={(color) => patch({ color })}
          />
        </div>
      );
      break;
    default:
      body = null;
  }
  if (!body) return null;
  return <PartTools className="gw-cc-tools">{body}</PartTools>;
}

/** The `+` at the foot of the message, or of a container. */
function AddRow({
  nested = false,
  empty,
  disabled,
  onAdd,
  onPlace,
}: {
  nested?: boolean;
  empty: boolean;
  disabled: boolean;
  onAdd: (type: string) => void;
  onPlace?: () => void;
}) {
  return (
    <div className="gw-cc-add" data-empty={empty ? "true" : undefined} data-md-keep>
      <AddBlockMenu
        nested={nested}
        disabled={disabled}
        onAdd={onAdd}
        trigger={
          <button type="button" className="gw-cv-add" disabled={disabled}>
            <IconPlus size={13} aria-hidden="true" />
            {empty ? (nested ? "Add a block inside" : "Add the first block") : "Block"}
          </button>
        }
      />
      {onPlace ? (
        <button type="button" className="gw-cv-add" onClick={onPlace}>
          <IconPlus size={13} aria-hidden="true" />
          Feature button
        </button>
      ) : null}
    </div>
  );
}

