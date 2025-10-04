package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
)

type service struct {
	name string
	dir  string
	cmd  *exec.Cmd
}

func (s *service) runService() error {
	cmd := exec.Command("go", "run", ".")
	cmd.Dir = s.dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		return err
	}
	fmt.Printf("%s started (pid %d) in %s\n", s.name, cmd.Process.Pid, s.dir)
	s.cmd = cmd
	return nil
}

func (s *service) stopService() {
	if s.cmd == nil || s.cmd.Process == nil {
		return
	}
	// Try graceful interrupt first on non-Windows; Windows fallback to Kill
	if runtime.GOOS != "windows" {
		_ = s.cmd.Process.Signal(os.Interrupt)
	}
	// Always attempt Kill after a short best-effort
	_ = s.cmd.Process.Kill()
}

func main() {
	root, _ := os.Getwd()
	base := filepath.Clean(filepath.Join(root, ".."))
	services := []service{
		{name: "auth-service", dir: filepath.Join(base, "golang-auth-service")},
		{name: "project-service", dir: filepath.Join(base, "golang-project-service")},
		{name: "websocket-service", dir: filepath.Join(base, "golang-websocket-service")},
	}

	// Start all services
	for i := range services {
		if err := services[i].runService(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to start %s: %v\n", services[i].name, err)
		}
	}

	// Block until Ctrl+C / SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	fmt.Println("\nStopping services...")
	for i := range services {
		services[i].stopService()
	}
}
