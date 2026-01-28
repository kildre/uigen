import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

// Mock anon-work-tracker
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

// Mock project actions
vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signIn", () => {
    test("returns success and redirects to saved anonymous work project", async () => {
      const mockProject = { id: "new-project-123" };
      const mockAnonWork = {
        messages: [{ role: "user", content: "test message" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "test" } },
      };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "password123");
      });

      expect(signInResult).toEqual({ success: true });
      expect(signInAction).toHaveBeenCalledWith("test@example.com", "password123");
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-project-123");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("returns success and redirects to most recent project when no anonymous work", async () => {
      const mockProjects = [
        { id: "project-1", name: "Recent Project" },
        { id: "project-2", name: "Older Project" },
      ];

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates new project when no anonymous work and no existing projects", async () => {
      const mockNewProject = { id: "brand-new-project" };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue(mockNewProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });

    test("returns error and does not redirect on failed sign in", async () => {
      (signInAction as any).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(signInResult).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("sets isLoading to true during sign in and false after", async () => {
      let resolveSignIn: (value: any) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });

      (signInAction as any).mockReturnValue(signInPromise);
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let signInPromiseResult: Promise<any>;
      act(() => {
        signInPromiseResult = result.current.signIn("test@example.com", "password123");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignIn!({ success: true });
        await signInPromiseResult;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when sign in fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("handles empty messages array in anonymous work", async () => {
      const mockProject = { id: "existing-project" };
      const mockAnonWork = {
        messages: [],
        fileSystemData: {},
      };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (getProjects as any).mockResolvedValue([mockProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      // Should skip anonymous work and go to existing projects
      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("signUp", () => {
    test("returns success and redirects to saved anonymous work project", async () => {
      const mockProject = { id: "new-project-456" };
      const mockAnonWork = {
        messages: [{ role: "user", content: "my design" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "code" } },
      };

      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp("newuser@example.com", "password123");
      });

      expect(signUpResult).toEqual({ success: true });
      expect(signUpAction).toHaveBeenCalledWith("newuser@example.com", "password123");
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-project-456");
    });

    test("returns success and creates new project for new user", async () => {
      const mockNewProject = { id: "first-project" };

      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue(mockNewProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });

    test("returns error and does not redirect on failed sign up", async () => {
      (signUpAction as any).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp("existing@example.com", "password123");
      });

      expect(signUpResult).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getAnonWorkData).not.toHaveBeenCalled();
    });

    test("returns error for password too short", async () => {
      (signUpAction as any).mockResolvedValue({
        success: false,
        error: "Password must be at least 8 characters",
      });

      const { result } = renderHook(() => useAuth());

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp("newuser@example.com", "short");
      });

      expect(signUpResult).toEqual({
        success: false,
        error: "Password must be at least 8 characters",
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to true during sign up and false after", async () => {
      let resolveSignUp: (value: any) => void;
      const signUpPromise = new Promise((resolve) => {
        resolveSignUp = resolve;
      });

      (signUpAction as any).mockReturnValue(signUpPromise);
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "new-project" });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let signUpPromiseResult: Promise<any>;
      act(() => {
        signUpPromiseResult = result.current.signUp("newuser@example.com", "password123");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignUp!({ success: true });
        await signUpPromiseResult;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when sign up fails", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("hook return value", () => {
    test("returns signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty("signIn");
      expect(result.current).toHaveProperty("signUp");
      expect(result.current).toHaveProperty("isLoading");
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });

    test("isLoading is initially false", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });
  });
});
