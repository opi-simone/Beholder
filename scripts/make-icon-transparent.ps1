Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class IconAlpha {
  public static void Run(string jpg, string outDir) {
    using (var src = new Bitmap(jpg)) {
      var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
      PunchCorners(bmp);
      bmp.Save(System.IO.Path.Combine(outDir, "icon.png"), ImageFormat.Png);
      foreach (var size in new[] { 256, 48, 32, 16 }) {
        SaveResized(bmp, size, System.IO.Path.Combine(outDir, "icon-" + size + ".png"));
      }
      bmp.Dispose();
    }
  }

  static void PunchCorners(Bitmap bmp) {
    int w = bmp.Width, h = bmp.Height;
    var rect = new Rectangle(0, 0, w, h);
    var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = Math.Abs(data.Stride);
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    bool[] vis = new bool[w * h];
    var q = new Queue<int>();
    Action<int,int> tryEnq = (x, y) => {
      if ((uint)x >= (uint)w || (uint)y >= (uint)h) return;
      int vi = y * w + x;
      if (vis[vi]) return;
      int i = y * stride + x * 4;
      byte b = buf[i], g = buf[i + 1], r = buf[i + 2], a = buf[i + 3];
      if (a == 0 || r >= 30 || g >= 30 || b >= 30) return;
      vis[vi] = true;
      q.Enqueue(vi);
    };
    tryEnq(0, 0); tryEnq(w - 1, 0); tryEnq(0, h - 1); tryEnq(w - 1, h - 1);
    while (q.Count > 0) {
      int vi = q.Dequeue();
      int x = vi % w, y = vi / w;
      buf[y * stride + x * 4 + 3] = 0;
      tryEnq(x + 1, y); tryEnq(x - 1, y); tryEnq(x, y + 1); tryEnq(x, y - 1);
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    bmp.UnlockBits(data);
  }

  static void SaveResized(Bitmap source, int size, string path) {
    using (var dest = new Bitmap(size, size, PixelFormat.Format32bppArgb))
    using (var g = Graphics.FromImage(dest)) {
      g.CompositingMode = CompositingMode.SourceOver;
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.Clear(Color.Transparent);
      g.DrawImage(source, 0, 0, size, size);
      dest.Save(path, ImageFormat.Png);
    }
  }
}
"@

[IconAlpha]::Run('c:\progetti\Beholder\resources\icon.jpg', 'c:\progetti\Beholder\resources')
Write-Output 'ok'
