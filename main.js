/// <reference path="typings/jquery.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
$().ready(function () {
    $("#btnApply").click(function () {
        var img = document.getElementById("img");
        $(document.body).append("<span>Output</span><br/>");
        var c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        document.body.appendChild(c);
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        var mat = ImageOperations.Mat.fromImage(img).toRGB();
        var dst = mat;
        dst = shadowRemoval(dst);
        dst.toCanvas(c);
    });
});
function shadowRemoval(mat) {
    //if (mat.channels < 3)
    //     throw new Error("RGB must be present");
    var dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var alphaDst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var upL_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var upA_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var upB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var upRGB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var ucL_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var ucA_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    var ucB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    // use mean beta values
    var beta1 = 2.557;
    var beta2 = 1.889;
    var beta3 = 1.682;
    var eps = 0.15;
    var kappa = 0.02;
    // determine normalized u0
    var u0_0 = beta1 * beta2 - 1;
    var u0_1 = 1 + beta1;
    var u0_2 = 1 + beta2;
    // normalize
    var norm_u0 = Math.sqrt(u0_0 * u0_0 + u0_1 * u0_1 + u0_2 * u0_2);
    u0_0 /= norm_u0;
    u0_1 /= norm_u0;
    u0_2 /= norm_u0;
    // determine T vector
    var t_0_sum = 0;
    var t_1_sum = 0;
    var t_2_sum = 0;
    var idx = 0;
    var nrInS = 0;
    for (var j = 0; j < mat.height; j++) {
        for (var i = 0; i < mat.width; i++) {
            var v_r = mat.data[idx];
            var v_g = mat.data[idx + 1];
            var v_b = mat.data[idx + 2];
            // calculate u vector
            var u_r = Math.log(v_r + 14);
            var u_g = Math.log(v_g + 14);
            var u_b = Math.log(v_b + 14);
            // determine alpha which is - < u0 . u >
            var alpha = -(u0_0 * u_r + u0_1 * u_g + u0_2 * u_b);
            var up_0 = u_r + alpha * u0_0;
            var up_1 = u_g + alpha * u0_1;
            var up_2 = u_b + alpha * u0_2;
            var norm_u = Math.sqrt(u_r * u_r + u_g * u_g + u_b * u_b);
            // calculate || u / ||u|| - u0 || and check if it's below epsilon
            var norm_diff = Math.sqrt((u_r / norm_u - u0_0) * (u_r / norm_u - u0_0) + (u_g / norm_u - u0_1) * (u_g / norm_u - u0_1) + (u_b / norm_u - u0_2) * (u_b / norm_u - u0_2));
            if (norm_diff <= eps) {
                t_0_sum += (u0_0 - u_r / norm_u);
                t_1_sum += (u0_1 - u_g / norm_u);
                t_2_sum += (u0_2 - u_b / norm_u);
                nrInS++;
            }
        }
    }
    // normalize T components by the amount of pixels that are in S (* 1/G)
    var t_0 = t_0_sum / nrInS;
    var t_1 = t_1_sum / nrInS;
    var t_2 = t_2_sum / nrInS;
    console.log("T= " + t_0 + "," + t_1 + "," + t_2);
    for (var j = 0; j < mat.height; j++) {
        for (var i = 0; i < mat.width; i++) {
            var v_r = mat.data[idx];
            var v_g = mat.data[idx + 1];
            var v_b = mat.data[idx + 2];
            // determine u
            var u_r = Math.log(v_r + 14);
            var u_g = Math.log(v_g + 14);
            var u_b = Math.log(v_b + 14);
            var norm_u = Math.sqrt(u_r * u_r + u_g * u_g + u_b * u_b);
            var norm_diff = Math.sqrt((u_r / norm_u - u0_0) * (u_r / norm_u - u0_0)
                + (u_g / norm_u - u0_1) * (u_g / norm_u - u0_1)
                + (u_b / norm_u - u0_2) * (u_b / norm_u - u0_2));
            // if the pixel is in S
            if (norm_diff <= eps) {
                // determine alpha which is - < u0 . u >
                var alpha = -(u0_0 * u_r + u0_1 * u_g + u0_2 * u_b);
                // u_p = u - u.u0 * u0
                var up_0 = u_r + alpha * u0_0;
                var up_1 = u_g + alpha * u0_1;
                var up_2 = u_b + alpha * u0_2;
                var norm_up = Math.sqrt(up_0 * up_0 + up_1 * up_1 + up_2 * up_2);
                // determine smoothing factor
                var smoothing = 1 / (kappa * Math.pow((norm_diff), 3) + 1);
                // u_c = || u_p || * (u_p / ||u_p +  smoothing * T)
                var uc_0 = norm_up * (up_0 / norm_up + smoothing * t_0);
                var uc_1 = norm_up * (up_1 / norm_up + smoothing * t_1);
                var uc_2 = norm_up * (up_2 / norm_up + smoothing * t_2);
                // convert log space back to RGB space
                var uc_rgb = [Math.exp(uc_0) * 255, Math.exp(uc_1) * 255, Math.exp(uc_2) * 255];
                var up_rgb = [Math.exp(up_0) * 255, Math.exp(up_1) * 255, Math.exp(up_2) * 255];
                // convert u_c and u_p RGB to Lab
                var uc_lab = ColorConversions.rgb2lab(uc_rgb);
                var up_lab = ColorConversions.rgb2lab(up_rgb);
                // combine luminance of u_c and a,b components of u_p together
                var final_lab = [uc_lab[0], up_lab[1], up_lab[2]];
                // convert the final Lab value back to RGB
                var final_rgb = ColorConversions.xyz2rgb(ColorConversions.lab2xyz(final_lab));
                // dst is a Mat32F so the range should be 0-1   
                dst.data[idx + 0] = (final_rgb[0] / 255);
                dst.data[idx + 1] = (final_rgb[1] / 255);
                dst.data[idx + 2] = (final_rgb[2] / 255);
                alphaDst.data[idx + 0] = -alpha;
                alphaDst.data[idx + 1] = -alpha;
                alphaDst.data[idx + 2] = -alpha;
                upL_Dst.data[idx + 0] = up_lab[0];
                upL_Dst.data[idx + 1] = up_lab[0];
                upL_Dst.data[idx + 2] = up_lab[0];
                upA_Dst.data[idx + 0] = up_lab[1];
                upA_Dst.data[idx + 1] = up_lab[1];
                upA_Dst.data[idx + 2] = up_lab[1];
                upB_Dst.data[idx + 0] = up_lab[2];
                upB_Dst.data[idx + 1] = up_lab[2];
                upB_Dst.data[idx + 2] = up_lab[2];
                upRGB_Dst.data[idx + 0] = up_rgb[0];
                upRGB_Dst.data[idx + 1] = up_rgb[1];
                upRGB_Dst.data[idx + 2] = up_rgb[2];
                ucL_Dst.data[idx + 0] = uc_lab[0];
                ucL_Dst.data[idx + 1] = uc_lab[0];
                ucL_Dst.data[idx + 2] = uc_lab[0];
                ucA_Dst.data[idx + 0] = uc_lab[1];
                ucA_Dst.data[idx + 1] = uc_lab[1];
                ucA_Dst.data[idx + 2] = uc_lab[1];
                ucB_Dst.data[idx + 0] = uc_lab[2];
                ucB_Dst.data[idx + 1] = uc_lab[2];
                ucB_Dst.data[idx + 2] = uc_lab[2];
            }
            idx += mat.channels;
        }
    }
    dumpImage(alphaDst, "Alpha");
    dumpImage(upL_Dst, "Up Luminance");
    dumpImage(upA_Dst, "Up a");
    dumpImage(upB_Dst, "Up b");
    dumpImage(upRGB_Dst, "Up RGB");
    dumpImage(ucL_Dst, "Uc Luminance");
    dumpImage(ucA_Dst, "Uc a");
    dumpImage(ucB_Dst, "Uc b");
    return dst;
}
var ColorConversions;
(function (ColorConversions) {
    function xyz2rgb(xyz) {
        var x = xyz[0] / 100;
        var y = xyz[1] / 100;
        var z = xyz[2] / 100;
        var r;
        var g;
        var b;
        r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
        g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
        b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);
        // assume sRGB
        r = r > 0.0031308
            ? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
            : r *= 12.92;
        g = g > 0.0031308
            ? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
            : g *= 12.92;
        b = b > 0.0031308
            ? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
            : b *= 12.92;
        //  r = Math.min(Math.max(0, r), 1);
        //  g = Math.min(Math.max(0, g), 1);
        //  b = Math.min(Math.max(0, b), 1);
        return [r * 255, g * 255, b * 255];
    }
    ColorConversions.xyz2rgb = xyz2rgb;
    function lab2xyz(lab) {
        var l = lab[0];
        var a = lab[1];
        var b = lab[2];
        var x;
        var y;
        var z;
        var y2;
        if (l <= 8) {
            y = (l * 100) / 903.3;
            y2 = (7.787 * (y / 100)) + (16 / 116);
        }
        else {
            y = 100 * Math.pow((l + 16) / 116, 3);
            y2 = Math.pow(y / 100, 1 / 3);
        }
        x = x / 95.047 <= 0.008856
            ? x = (95.047 * ((a / 500) + y2 - (16 / 116))) / 7.787
            : 95.047 * Math.pow((a / 500) + y2, 3);
        z = z / 108.883 <= 0.008859
            ? z = (108.883 * (y2 - (b / 200) - (16 / 116))) / 7.787
            : 108.883 * Math.pow(y2 - (b / 200), 3);
        return [x, y, z];
    }
    ColorConversions.lab2xyz = lab2xyz;
    function rgb2xyz(rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        // assume sRGB
        r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
        g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
        b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);
        var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
        var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
        var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);
        return [x * 100, y * 100, z * 100];
    }
    ColorConversions.rgb2xyz = rgb2xyz;
    function rgb2lab(rgb) {
        var xyz = rgb2xyz(rgb);
        var x = xyz[0];
        var y = xyz[1];
        var z = xyz[2];
        var l;
        var a;
        var b;
        x /= 95.047;
        y /= 100;
        z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);
        l = (116 * y) - 16;
        a = 500 * (x - y);
        b = 200 * (y - z);
        return [l, a, b];
    }
    ColorConversions.rgb2lab = rgb2lab;
})(ColorConversions || (ColorConversions = {}));
function dumpImage(mat, name) {
    if (name === void 0) { name = ""; }
    var canv = document.createElement("canvas");
    canv.width = mat.width;
    canv.height = mat.height;
    if (name != "")
        $(document.body).append("<br/><span>" + name + "</span><br/>");
    document.body.appendChild(canv);
    ImageOperations.normalize(mat).toCanvas(canv);
    return canv;
}
var ImageOperations;
(function (ImageOperations) {
    function normalize(mat) {
        var dst = new Mat32F(mat.width, mat.height, mat.channels);
        var max = new Array(mat.channels);
        var min = new Array(mat.channels);
        for (var c = 0; c < mat.channels; c++) {
            min[c] = Number.MAX_VALUE;
            max[c] = Number.MIN_VALUE;
        }
        var idx = 0;
        for (var j = 0; j < mat.height; j++) {
            for (var i = 0; i < mat.width; i++) {
                for (var c = 0; c < mat.channels; c++) {
                    var val = mat.data[idx];
                    if (max[c] < val)
                        max[c] = val;
                    if (min[c] > val)
                        min[c] = val;
                    idx++;
                }
            }
        }
        idx = 0;
        for (var j = 0; j < mat.height; j++) {
            for (var i = 0; i < mat.width; i++) {
                for (var c = 0; c < mat.channels; c++) {
                    var val = (mat.data[idx] - min[c]) / (max[c] - min[c]);
                    dst.data[idx] = val;
                    idx++;
                }
            }
        }
        return dst;
    }
    ImageOperations.normalize = normalize;
    function normalizeCombineChannels(mat) {
        var dst = new Mat32F(mat.width, mat.height, mat.channels);
        var max = Number.MIN_VALUE;
        var min = Number.MAX_VALUE;
        var idx = 0;
        for (var j = 0; j < mat.height; j++) {
            for (var i = 0; i < mat.width; i++) {
                for (var c = 0; c < mat.channels; c++) {
                    var val = mat.data[idx];
                    if (max < val)
                        max = val;
                    if (min > val)
                        min = val;
                    idx++;
                }
            }
        }
        idx = 0;
        for (var j = 0; j < mat.height; j++) {
            for (var i = 0; i < mat.width; i++) {
                for (var c = 0; c < mat.channels; c++) {
                    var val = (mat.data[idx] - min) / (max - min);
                    dst.data[idx] = val;
                    idx++;
                }
            }
        }
        return dst;
    }
    ImageOperations.normalizeCombineChannels = normalizeCombineChannels;
    var Mat = (function () {
        function Mat(width, height, channels) {
            this.width = width;
            this.height = height;
            this.channels = channels;
        }
        Mat.fromImage = function (img) {
            var canv = document.createElement("canvas");
            var ctx = canv.getContext("2d");
            canv.width = img.width;
            canv.height = img.height;
            ctx.drawImage(img, 0, 0);
            var tmp = ctx.getImageData(0, 0, canv.width, canv.height);
            var m = new Mat8U(canv.width, canv.height, 4);
            m.data = tmp.data.slice(0);
            return m;
        };
        Object.defineProperty(Mat.prototype, "bits", {
            get: function () {
                return 0;
                // make abstract when typescript allows abstract properties
            },
            enumerable: true,
            configurable: true
        });
        Mat.prototype.isSameDimensions = function (other) {
            return this.width == other.width && this.height == other.height && this.channels == other.channels;
        };
        Mat.prototype.indexOf = function (x, y, channel) {
            if (channel === void 0) { channel = 0; }
            return (y * this.width + x) * this.channels + channel;
        };
        return Mat;
    })();
    ImageOperations.Mat = Mat;
    var Mat8U = (function (_super) {
        __extends(Mat8U, _super);
        function Mat8U(width, height, channels) {
            _super.call(this, width, height, channels);
            this.data = new Uint8ClampedArray(width * height * channels);
        }
        Mat8U.prototype.toCanvas = function (c) {
            c.width = this.width;
            c.height = this.height;
            var ctx = c.getContext("2d");
            var imgData = ctx.getImageData(0, 0, c.width, c.height);
            if (this.channels == 4) {
                imgData.data.set(this.data);
            }
            else {
                var m = this.toRGBA();
                imgData.data.set(m.data);
            }
            ctx.putImageData(imgData, 0, 0);
        };
        Mat8U.prototype.createNew = function (width, height, channels) {
            return new Mat8U(width, height, channels);
        };
        Object.defineProperty(Mat8U.prototype, "bits", {
            get: function () { return 8; },
            enumerable: true,
            configurable: true
        });
        Mat8U.prototype.toRGB = function () {
            var mat = new Mat8U(this.width, this.height, 3);
            if (this.channels == 1) {
                // c -> RGB
                for (var i = 0; i < this.data.length; i++) {
                    mat.data[i * 3] = this.data[i];
                    mat.data[i * 3 + 1] = this.data[i];
                    mat.data[i * 3 + 2] = this.data[i];
                }
            }
            else if (this.channels == 3) {
                mat.data = this.data.slice(0);
            }
            else if (this.channels == 4) {
                var idx = 0;
                for (var i = 0; i < this.data.length; i += 4) {
                    mat.data[idx] = this.data[i];
                    mat.data[idx + 1] = this.data[i + 1];
                    mat.data[idx + 2] = this.data[i + 2];
                    idx += 3;
                }
            }
            return mat;
        };
        Mat8U.prototype.toRGBA = function () {
            var mat = new Mat8U(this.width, this.height, 4);
            if (this.channels == 1) {
                // c -> RGB, a
                for (var i = 0; i < this.data.length; i++) {
                    mat.data[i * 4] = this.data[i];
                    mat.data[i * 4 + 1] = this.data[i];
                    mat.data[i * 4 + 2] = this.data[i];
                    mat.data[i * 4 + 3] = 255;
                }
            }
            else if (this.channels == 3) {
                // c1,c2,c3 -> RGB , a
                var idx = 0;
                for (var i = 0; i < this.data.length; i += 3) {
                    mat.data[idx] = this.data[i];
                    mat.data[idx + 1] = this.data[i + 1];
                    mat.data[idx + 2] = this.data[i + 2];
                    mat.data[idx + 3] = 255;
                    idx += 4;
                }
            }
            else if (this.channels == 4) {
                mat.data = this.data.slice(0);
            }
            return mat;
        };
        Mat8U.prototype.to32F = function () {
            var mat = new Mat32F(this.width, this.height, this.channels);
            var idx = 0;
            for (var j = 0; j < this.height; j++) {
                for (var i = 0; i < this.width; i++) {
                    for (var c = 0; c < this.channels; c++) {
                        mat.data[idx] = this.data[idx] / 255;
                        idx++;
                    }
                }
            }
            return mat;
        };
        return Mat8U;
    })(Mat);
    ImageOperations.Mat8U = Mat8U;
    var Mat32F = (function (_super) {
        __extends(Mat32F, _super);
        function Mat32F(width, height, channels) {
            _super.call(this, width, height, channels);
            this.data = new Float32Array(width * height * channels);
        }
        Mat32F.fromArray = function (arr, w, h) {
            var m = new Mat32F(w, h, 1);
            var idx = 0;
            for (var j = 0; j < h; j++) {
                for (var i = 0; i < w; i++) {
                    m.data[idx] = arr[j][i];
                    idx++;
                }
            }
            return m;
        };
        Object.defineProperty(Mat32F.prototype, "bits", {
            get: function () { return 32; },
            enumerable: true,
            configurable: true
        });
        Mat32F.prototype.createNew = function (width, height, channels) {
            return new Mat32F(width, height, channels);
        };
        Mat32F.prototype.toCanvas = function (c) {
            this.to8U().toCanvas(c);
        };
        Mat32F.prototype.to8U = function () {
            var mat = new Mat8U(this.width, this.height, this.channels);
            var idx = 0;
            for (var j = 0; j < this.height; j++) {
                for (var i = 0; i < this.width; i++) {
                    for (var c = 0; c < this.channels; c++) {
                        mat.data[idx] = this.data[idx] * 255;
                        idx++;
                    }
                }
            }
            return mat;
        };
        return Mat32F;
    })(Mat);
    ImageOperations.Mat32F = Mat32F;
})(ImageOperations || (ImageOperations = {}));
