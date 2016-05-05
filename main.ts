/// <reference path="typings/jquery.d.ts" />


$().ready(function() {

    $("#btnApply").click(function() {
        let img = <HTMLImageElement>document.getElementById("img");

        $(document.body).append("<span>Output</span><br/>");
        let c = <HTMLCanvasElement>document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        document.body.appendChild(c);

        let ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);


        let mat = <ImageOperations.Mat<Uint8Array>>ImageOperations.Mat.fromImage(img).toRGB();

        let dst = mat;

        dst = shadowRemoval(dst);

        dst.toCanvas(c);
    });
});

function shadowRemoval<T>(mat: ImageOperations.Mat<T>): ImageOperations.Mat32F {
    //if (mat.channels < 3)
    //     throw new Error("RGB must be present");

    let dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let alphaDst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let upL_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let upA_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let upB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);

    let upRGB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);

    let ucL_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let ucA_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);
    let ucB_Dst = new ImageOperations.Mat32F(mat.width, mat.height, mat.channels);


    // use mean beta values
    let beta1 = 2.557;
    let beta2 = 1.889;
    let beta3 = 1.682;
    let eps = 0.15;
    let kappa = 0.02;

    // determine normalized u0

    let u0_0 = beta1 * beta2 - 1;
    let u0_1 = 1 + beta1;
    let u0_2 = 1 + beta2;
    // normalize
    let norm_u0 = Math.sqrt(u0_0 * u0_0 + u0_1 * u0_1 + u0_2 * u0_2);
    u0_0 /= norm_u0;
    u0_1 /= norm_u0;
    u0_2 /= norm_u0;


    // determine T vector
    let t_0_sum = 0;
    let t_1_sum = 0;
    let t_2_sum = 0;

    let idx = 0;

    let nrInS = 0;
    for (let j: number = 0; j < mat.height; j++) {
        for (let i: number = 0; i < mat.width; i++) {
            let v_r = mat.data[idx];
            let v_g = mat.data[idx + 1];
            let v_b = mat.data[idx + 2];

            // calculate u vector
            let u_r = Math.log(v_r + 14);
            let u_g = Math.log(v_g + 14);
            let u_b = Math.log(v_b + 14);

            // determine alpha which is - < u0 . u >
            let alpha = -(u0_0 * u_r + u0_1 * u_g + u0_2 * u_b);
            let up_0 = u_r + alpha * u0_0;
            let up_1 = u_g + alpha * u0_1;
            let up_2 = u_b + alpha * u0_2;

            let norm_u = Math.sqrt(u_r * u_r + u_g * u_g + u_b * u_b);

            // calculate || u / ||u|| - u0 || and check if it's below epsilon
            let norm_diff = Math.sqrt((u_r / norm_u - u0_0) * (u_r / norm_u - u0_0) + (u_g / norm_u - u0_1) * (u_g / norm_u - u0_1) + (u_b / norm_u - u0_2) * (u_b / norm_u - u0_2));
            if (norm_diff <= eps) {
                t_0_sum += (u0_0 - u_r / norm_u);
                t_1_sum += (u0_1 - u_g / norm_u);
                t_2_sum += (u0_2 - u_b / norm_u);
                nrInS++;
            }
        }
    }
    // normalize T components by the amount of pixels that are in S (* 1/G)
    let t_0 = t_0_sum / nrInS;
    let t_1 = t_1_sum / nrInS;
    let t_2 = t_2_sum / nrInS;

    console.log("T= " + t_0 + "," + t_1 + "," + t_2);

    for (let j: number = 0; j < mat.height; j++) {
        for (let i: number = 0; i < mat.width; i++) {
            let v_r = mat.data[idx];
            let v_g = mat.data[idx + 1];
            let v_b = mat.data[idx + 2];

            // determine u
            let u_r = Math.log(v_r + 14);
            let u_g = Math.log(v_g + 14);
            let u_b = Math.log(v_b + 14);

            let norm_u = Math.sqrt(u_r * u_r + u_g * u_g + u_b * u_b);

            let norm_diff = Math.sqrt(
                (u_r / norm_u - u0_0) * (u_r / norm_u - u0_0)
                + (u_g / norm_u - u0_1) * (u_g / norm_u - u0_1)
                + (u_b / norm_u - u0_2) * (u_b / norm_u - u0_2));

            // if the pixel is in S
            if (norm_diff <= eps) {


                // determine alpha which is - < u0 . u >
                let alpha = -(u0_0 * u_r + u0_1 * u_g + u0_2 * u_b);

                // u_p = u - u.u0 * u0
                let up_0 = u_r + alpha * u0_0;
                let up_1 = u_g + alpha * u0_1;
                let up_2 = u_b + alpha * u0_2;

                let norm_up = Math.sqrt(up_0 * up_0 + up_1 * up_1 + up_2 * up_2);

                // determine smoothing factor
                let smoothing = 1 / (kappa * (norm_diff) ** 3 + 1);

                // u_c = || u_p || * (u_p / ||u_p +  smoothing * T)
                let uc_0 = norm_up * (up_0 / norm_up + smoothing * t_0);
                let uc_1 = norm_up * (up_1 / norm_up + smoothing * t_1);
                let uc_2 = norm_up * (up_2 / norm_up + smoothing * t_2);

                // convert log space back to RGB space
                let uc_rgb = [Math.exp(uc_0)*255, Math.exp(uc_1)*255, Math.exp(uc_2)*255];
                let up_rgb = [Math.exp(up_0)*255, Math.exp(up_1)*255, Math.exp(up_2)*255];

                // convert u_c and u_p RGB to Lab
                let uc_lab: number[] = ColorConversions.rgb2lab(uc_rgb);
                let up_lab: number[] = ColorConversions.rgb2lab(up_rgb);

                // combine luminance of u_c and a,b components of u_p together
                let final_lab: number[] = [uc_lab[0], up_lab[1], up_lab[2]];

                // convert the final Lab value back to RGB
                let final_rgb = ColorConversions.xyz2rgb(ColorConversions.lab2xyz(final_lab));

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


namespace ColorConversions {

    export function xyz2rgb(xyz: number[]): number[] {
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

    export function lab2xyz(lab: number[]): number[] {
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
        } else {
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


    export function rgb2xyz(rgb: number[]): number[] {

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

    export function rgb2lab(rgb: number[]): number[] {
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
}

function dumpImage<T>(mat: ImageOperations.Mat<T>, name: string = "") {
    let canv = <HTMLCanvasElement>document.createElement("canvas");

    canv.width = mat.width;
    canv.height = mat.height;
    if (name != "")
        $(document.body).append("<br/><span>" + name + "</span><br/>");
    document.body.appendChild(canv);
    ImageOperations.normalize(mat).toCanvas(canv);

    return canv;
}


namespace ImageOperations {

    export function normalize<T>(mat: Mat<T>): Mat32F {

        let dst = new Mat32F(mat.width, mat.height, mat.channels);

        let max: number[] = new Array(mat.channels);
        let min: number[] = new Array(mat.channels);
        for (let c: number = 0; c < mat.channels; c++) {
            min[c] = Number.MAX_VALUE;
            max[c] = Number.MIN_VALUE;
        }

        let idx = 0;
        for (let j: number = 0; j < mat.height; j++) {
            for (let i: number = 0; i < mat.width; i++) {

                for (let c: number = 0; c < mat.channels; c++) {
                    let val = mat.data[idx];
                    if (max[c] < val) max[c] = val;
                    if (min[c] > val) min[c] = val;
                    idx++;
                }
            }
        }

        idx = 0;
        for (let j: number = 0; j < mat.height; j++) {
            for (let i: number = 0; i < mat.width; i++) {

                for (let c: number = 0; c < mat.channels; c++) {
                    let val = (mat.data[idx] - min[c]) / (max[c] - min[c]);
                    dst.data[idx] = val;
                    idx++;
                }
            }
        }

        return dst;
    }

    export function normalizeCombineChannels<T>(mat: Mat<T>): Mat32F {

        let dst = new Mat32F(mat.width, mat.height, mat.channels);

        let max: number = Number.MIN_VALUE;
        let min: number = Number.MAX_VALUE;


        let idx = 0;
        for (let j: number = 0; j < mat.height; j++) {
            for (let i: number = 0; i < mat.width; i++) {

                for (let c: number = 0; c < mat.channels; c++) {
                    let val = mat.data[idx];
                    if (max < val) max = val;
                    if (min > val) min = val;
                    idx++;
                }
            }
        }

        idx = 0;
        for (let j: number = 0; j < mat.height; j++) {
            for (let i: number = 0; i < mat.width; i++) {

                for (let c: number = 0; c < mat.channels; c++) {
                    let val = (mat.data[idx] - min) / (max - min);
                    dst.data[idx] = val;
                    idx++;
                }
            }
        }
        return dst;
    }

    export abstract class Mat<T> {
        public data: T;
        constructor(public width: number, public height: number, public channels: number) {
        }

        static fromImage(img: HTMLImageElement): Mat8U {

            let canv = <HTMLCanvasElement>document.createElement("canvas");
            let ctx = canv.getContext("2d");
            canv.width = img.width;
            canv.height = img.height;
            ctx.drawImage(img, 0, 0);
            let tmp = ctx.getImageData(0, 0, canv.width, canv.height);
            let m = new Mat8U(canv.width, canv.height, 4);
            m.data = <any>tmp.data.slice(0);
            return m;
        }

        get bits(): number {
            return 0;
            // make abstract when typescript allows abstract properties
        }

        isSameDimensions(other: Mat<T>): boolean {
            return this.width == other.width && this.height == other.height && this.channels == other.channels;
        }

        abstract createNew(width: number, height: number, channels: number): Mat<T>;

        indexOf(x: number, y: number, channel: number = 0): number {
            return (y * this.width + x) * this.channels + channel;
        }

        abstract toCanvas(c: HTMLCanvasElement);

    }

    export class Mat8U extends Mat<Uint8ClampedArray> {
        constructor(width: number, height: number, channels: number) {
            super(width, height, channels);
            this.data = new Uint8ClampedArray(width * height * channels);
        }

        toCanvas(c: HTMLCanvasElement) {
            c.width = this.width;
            c.height = this.height;
            let ctx = c.getContext("2d");
            let imgData = ctx.getImageData(0, 0, c.width, c.height);

            if (this.channels == 4) {
                (<any>imgData.data).set(this.data);
            }
            else {
                let m = this.toRGBA();
                (<any>imgData.data).set(m.data);
            }
            ctx.putImageData(imgData, 0, 0);
        }

        createNew(width: number, height: number, channels: number): Mat8U {
            return new Mat8U(width, height, channels);
        }

        get bits() { return 8; }

        toRGB(): Mat8U {
            let mat = new Mat8U(this.width, this.height, 3);

            if (this.channels == 1) {
                // c -> RGB
                for (let i: number = 0; i < this.data.length; i++) {
                    mat.data[i * 3] = this.data[i];
                    mat.data[i * 3 + 1] = this.data[i];
                    mat.data[i * 3 + 2] = this.data[i];
                }
            }
            else if (this.channels == 3) {

                mat.data = this.data.slice(0);

            }
            else if (this.channels == 4) {
                let idx = 0;
                for (let i: number = 0; i < this.data.length; i += 4) {
                    mat.data[idx] = this.data[i];
                    mat.data[idx + 1] = this.data[i + 1];
                    mat.data[idx + 2] = this.data[i + 2];
                    idx += 3;
                }
            }

            return mat;
        }

        toRGBA(): Mat8U {
            let mat = new Mat8U(this.width, this.height, 4);

            if (this.channels == 1) {
                // c -> RGB, a
                for (let i: number = 0; i < this.data.length; i++) {
                    mat.data[i * 4] = this.data[i];
                    mat.data[i * 4 + 1] = this.data[i];
                    mat.data[i * 4 + 2] = this.data[i];
                    mat.data[i * 4 + 3] = 255;
                }
            }
            else if (this.channels == 3) {
                // c1,c2,c3 -> RGB , a
                let idx = 0;
                for (let i: number = 0; i < this.data.length; i += 3) {
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
        }

        to32F(): Mat32F {
            let mat: Mat32F = new Mat32F(this.width, this.height, this.channels);
            let idx = 0;
            for (let j: number = 0; j < this.height; j++) {
                for (let i: number = 0; i < this.width; i++) {

                    for (let c: number = 0; c < this.channels; c++) {
                        mat.data[idx] = this.data[idx] / 255;
                        idx++;
                    }
                }
            }
            return mat;
        }

    }

    export class Mat32F extends Mat<Float32Array> {
        constructor(width: number, height: number, channels: number) {
            super(width, height, channels);
            this.data = new Float32Array(width * height * channels);
        }

        static fromArray(arr: number[][], w: number, h: number) {
            let m = new Mat32F(w, h, 1);
            let idx = 0;
            for (let j: number = 0; j < h; j++) {
                for (let i: number = 0; i < w; i++) {
                    m.data[idx] = arr[j][i];
                    idx++;
                }
            }
            return m;
        }

        get bits() { return 32; }

        createNew(width: number, height: number, channels: number): Mat32F {
            return new Mat32F(width, height, channels);
        }

        toCanvas(c: HTMLCanvasElement) {
            this.to8U().toCanvas(c);
        }

        to8U(): Mat8U {
            let mat: Mat8U = new Mat8U(this.width, this.height, this.channels);
            let idx = 0;
            for (let j: number = 0; j < this.height; j++) {
                for (let i: number = 0; i < this.width; i++) {

                    for (let c: number = 0; c < this.channels; c++) {
                        mat.data[idx] = this.data[idx] * 255;
                        idx++;
                    }
                }
            }
            return mat;
        }

    }
}