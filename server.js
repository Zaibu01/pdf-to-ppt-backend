const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "https://www.allroundtool.online/"
}));

const upload = multer({ dest: "uploads/" });

app.post("/convert", upload.single("file"), async (req, res) => {

  try {

    const apiKey = process.env.CLOUDCONVERT_API_KEY;

    const job = await axios.post(
      "https://api.cloudconvert.com/v2/jobs",
      {
        tasks: {
          "import-file": {
            operation: "import/upload"
          },
          "convert-file": {
            operation: "convert",
            input: "import-file",
            input_format: "pdf",
            output_format: "pptx"
          },
          "export-file": {
            operation: "export/url",
            input: "convert-file"
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    const uploadTask = job.data.data.tasks.find(
      t => t.name === "import-file"
    );

    const FormData = require("form-data");
    const form = new FormData();

    Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => {
      form.append(k, v);
    });

    form.append("file", fs.createReadStream(req.file.path));

    await axios.post(uploadTask.result.form.url, form, {
      headers: form.getHeaders()
    });

    let finished = false;
    let downloadUrl = "";

    while (!finished) {

      const status = await axios.get(
        `https://api.cloudconvert.com/v2/jobs/${job.data.data.id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        }
      );

      if (status.data.data.status === "finished") {

        finished = true;

        const exportTask = status.data.data.tasks.find(
          t => t.name === "export-file"
        );

        downloadUrl = exportTask.result.files[0].url;
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      download: downloadUrl
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Conversion failed"
    });

  }

});

app.listen(process.env.PORT, () => {
  console.log("Server running on port " + process.env.PORT);
});
