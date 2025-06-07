```mermaid
graph TD
subgraph G [7. User Interface]
  subgraph G1 [7.1 Dedicated Pages]
    G1a[Login and Register]
    G1b[Project or session select]
    G1c[Upload page]
    G1d[Annotation interface]
    G1e[Export UI]
    G1f[Settings page]
    G1a --> G1b --> G1c --> G1d --> G1e --> G1f
  end
  subgraph G2 [7.2 Image Viewer]
    G2a[Show annotations]
    G2b[Toggle views]
    G2c[Frame and batch navigation]
    G2a --> G2b --> G2c
  end
end

```