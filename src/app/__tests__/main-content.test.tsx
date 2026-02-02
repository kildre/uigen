import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

// Mock the dependencies
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <div>{children}</div>,
  useFileSystem: vi.fn(() => ({
    getAllFiles: vi.fn(() => new Map()),
    getFileContent: vi.fn(),
    updateFile: vi.fn(),
    selectedFile: null,
    refreshTrigger: 0,
  })),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <div>{children}</div>,
  useChat: vi.fn(() => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    status: "idle",
  })),
}));

// Mock the child components
vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview Frame</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Header Actions</div>,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

test("renders main content with chat and preview by default", async () => {
  const { container } = render(<MainContent />);

  // Wait for the component to mount
  await waitFor(() => {
    expect(screen.getByTestId("chat-interface")).toBeDefined();
  });

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});

test("toggle buttons are rendered", async () => {
  render(<MainContent />);

  await waitFor(() => {
    expect(screen.getByText("Preview")).toBeDefined();
  });

  expect(screen.getByText("Code")).toBeDefined();
});

test("clicking Code button switches to code view", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  // Wait for component to mount
  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });

  // Click the Code button
  const codeButton = screen.getByText("Code");
  await user.click(codeButton);

  // Verify code view is now shown
  await waitFor(() => {
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });
  expect(screen.getByTestId("file-tree")).toBeDefined();
  expect(screen.queryByTestId("preview-frame")).toBeNull();
});

test("clicking Preview button switches back to preview view", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  // Wait for component to mount
  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });

  // Click Code button first
  const codeButton = screen.getByText("Code");
  await user.click(codeButton);

  await waitFor(() => {
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });

  // Click Preview button
  const previewButton = screen.getByText("Preview");
  await user.click(previewButton);

  // Verify preview view is now shown
  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("toggle buttons can be clicked multiple times", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });

  const codeButton = screen.getByText("Code");
  const previewButton = screen.getByText("Preview");

  // Toggle multiple times
  await user.click(codeButton);
  await waitFor(() => {
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });

  await user.click(previewButton);
  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });

  await user.click(codeButton);
  await waitFor(() => {
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });

  await user.click(previewButton);
  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });

  // Final state should be preview
  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});
