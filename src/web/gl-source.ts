import { FrameSource, Patch } from '../core'

const VERTEX = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`

const SMALL = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform vec2 scale;
uniform vec2 size;
out vec4 color;
void main() {
  vec2 base = floor(gl_FragCoord.xy) * scale;
  vec2 q = scale * 0.25;
  vec3 s = texture(tex, (base + q) / size).rgb + texture(tex, (base + vec2(3.0, 1.0) * q) / size).rgb
         + texture(tex, (base + vec2(1.0, 3.0) * q) / size).rgb + texture(tex, (base + 3.0 * q) / size).rgb;
  color = vec4(s * 0.25, 1.0);
}`

const RECTIFY = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform mat3 hm;
uniform vec2 size;
out vec4 color;
vec3 tap(vec2 uv) {
  vec3 p = hm * vec3(uv, 1.0);
  return texture(tex, (p.xy / p.z + 0.5) / size).rgb;
}
void main() {
  vec2 c = floor(gl_FragCoord.xy) + 0.5;
  float d = 0.22;
  vec3 s = tap(c) + tap(c + vec2(d, 0.0)) + tap(c - vec2(d, 0.0)) + tap(c + vec2(0.0, d)) + tap(c - vec2(0.0, d));
  color = vec4(s / 5.0, 1.0);
}`

interface Target {
  fb: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
}

export class GlSource implements FrameSource {
  width = 0
  height = 0
  private gl: WebGL2RenderingContext
  private video: WebGLTexture
  private videoFb: WebGLFramebuffer
  private smallProg: WebGLProgram
  private rectProg: WebGLProgram
  private targets = new Map<string, Target>()

  static supported(): boolean {
    try {
      return !!document.createElement('canvas').getContext('webgl2')
    } catch {
      return false
    }
  }

  constructor() {
    const gl = document.createElement('canvas').getContext('webgl2', { preserveDrawingBuffer: false, antialias: false })
    if (!gl) throw new Error('WebGL2 tidak tersedia')
    this.gl = gl
    this.smallProg = this.program(SMALL)
    this.rectProg = this.program(RECTIFY)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.video = this.texture()
    this.videoFb = gl.createFramebuffer()!
  }

  update(frame: TexImageSource, width: number, height: number) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.video)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)
    if (width !== this.width || height !== this.height) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.videoFb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.video, 0)
    }
    this.width = width
    this.height = height
  }

  small(maxWidth: number) {
    const scale = Math.max(1, Math.ceil(this.width / maxWidth))
    const w = Math.floor(this.width / scale)
    const h = Math.floor(this.height / scale)
    this.draw(this.smallProg, w, h, (gl, p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'scale'), scale, scale)
    })
    return { data: this.read(w, h), w, h, scale }
  }

  region(x: number, y: number, w: number, h: number) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.videoFb)
    const out = new Uint8Array(w * h * 4)
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  rectify(patches: Patch[], w: number, h: number) {
    const gl = this.gl
    gl.enable(gl.SCISSOR_TEST)
    for (const patch of patches) {
      const m = patch.h
      gl.scissor(patch.x0, patch.y0, patch.x1 - patch.x0, patch.y1 - patch.y0)
      this.draw(this.rectProg, w, h, (g, p) => {
        g.uniformMatrix3fv(g.getUniformLocation(p, 'hm'), false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]])
      })
    }
    gl.disable(gl.SCISSOR_TEST)
    return this.read(w, h)
  }

  private draw(prog: WebGLProgram, w: number, h: number, setup: (gl: WebGL2RenderingContext, p: WebGLProgram) => void) {
    const gl = this.gl
    const t = this.target(w, h)
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
    gl.viewport(0, 0, w, h)
    gl.useProgram(prog)
    const loc = gl.getAttribLocation(prog, 'pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.video)
    gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0)
    gl.uniform2f(gl.getUniformLocation(prog, 'size'), this.width, this.height)
    setup(gl, prog)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private read(w: number, h: number) {
    const out = new Uint8Array(w * h * 4)
    this.gl.readPixels(0, 0, w, h, this.gl.RGBA, this.gl.UNSIGNED_BYTE, out)
    return out
  }

  private target(w: number, h: number): Target {
    const key = `${w}x${h}`
    let t = this.targets.get(key)
    if (t) return t
    const gl = this.gl
    const tex = this.texture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    t = { fb, tex, w, h }
    this.targets.set(key, t)
    return t
  }

  private texture() {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  private program(fragment: string) {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
    return p
  }
}
