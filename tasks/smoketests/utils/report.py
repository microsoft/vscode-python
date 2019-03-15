# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Original source can be found here:
# https://gist.github.com/fredizzimo/b92adf1d4596c0c1da1b05cc9899574b
# Code has been adopted to allow for adding attachments to cucumber reports.

import base64
import copy
import json

import six
from behave.formatter.base import Formatter
from behave.model_core import Status


class CucumberJSONFormatter(Formatter):
    instance = None
    name = "json"
    description = "JSON dump of test run"
    dumps_kwargs = {}

    json_number_types = six.integer_types + (float,)
    json_scalar_types = json_number_types + (six.text_type, bool, type(None))

    def __new__(cls, stream_opener, config):
        CucumberJSONFormatter.instance = object.__new__(cls)
        return CucumberJSONFormatter.instance

    def __init__(self, stream_opener, config):
        super(CucumberJSONFormatter, self).__init__(stream_opener, config)
        self.stream = self.open()
        self.feature_count = 0
        self.attachments = []
        self.current_feature = None
        self.current_feature_data = None
        self._step_index = 0
        self.current_background = None
        self.current_background_data = None

    def reset(self):
        self.current_feature = None
        self.current_feature_data = None
        self._step_index = 0
        self.current_background = None

    def uri(self, uri):
        pass

    def status(self, status_obj):
        if status_obj == Status.passed:
            return "passed"
        elif status_obj == Status.failed:
            return "failed"
        else:
            return "skipped"

    def feature(self, feature):
        self.reset()
        self.current_feature = feature
        self.current_feature_data = {
            "id": self.generate_id(feature),
            "uri": feature.location.filename,
            "line": feature.location.line,
            "description": "",
            "keyword": feature.keyword,
            "name": feature.name,
            "tags": self.write_tags(feature.tags),
            "status": self.status(feature.status),
        }
        element = self.current_feature_data
        if feature.description:
            element["description"] = self.format_description(feature.description)

    def background(self, background):
        element = {
            "type": "background",
            "keyword": background.keyword,
            "name": background.name,
            "location": six.text_type(background.location),
            "steps": [],
        }
        self._step_index = 0
        self.current_background = element

    def scenario(self, scenario):
        if self.current_background is not None:
            self.add_feature_element(copy.deepcopy(self.current_background))
        element = self.add_feature_element(
            {
                "type": "scenario",
                "id": self.generate_id(self.current_feature, scenario),
                "line": scenario.location.line,
                "description": "",
                "keyword": scenario.keyword,
                "name": scenario.name,
                "tags": self.write_tags(scenario.tags),
                "location": six.text_type(scenario.location),
                "steps": [],
            }
        )
        if scenario.description:
            element["description"] = self.format_description(scenario.description)
        self._step_index = 0

    @classmethod
    def make_table(cls, table):
        table_data = {
            "headings": table.headings,
            "rows": [list(row) for row in table.rows],
        }
        return table_data

    def step(self, step):
        self.attachments.clear()
        s = {
            "keyword": step.keyword,
            "step_type": step.step_type,
            "name": step.name,
            "line": step.location.line,
            "result": {"status": "skipped", "duration": 0},
            "embeddings": [],
        }

        if step.text:
            s["doc_string"] = {"value": step.text, "line": step.text.line}
        if step.table:
            s["rows"] = [{"cells": [heading for heading in step.table.headings]}]
            s["rows"] += [{"cells": [cell for cell in row.cells]} for row in step.table]

        if self.current_feature.background is not None:
            element = self.current_feature_data["elements"][-2]
            if len(element["steps"]) >= len(self.current_feature.background.steps):
                element = self.current_feature_element
        else:
            element = self.current_feature_element
        element["steps"].append(s)

    def match(self, match):
        if match.location:
            match_data = {"location": six.text_type(match.location) or ""}
            self.current_step["match"] = match_data

    def attach_image(self, base64):
        self.attachments.append({"mime_type": "image/png", "data": base64})

    def attach_html(self, html):
        self.attachments.append({"mime_type": "text/html", "data": html})

    def result(self, result):
        self.current_step["embeddings"] = self.attachments.copy()
        self.attachments.clear()
        self.current_step["result"] = {
            "status": self.status(result.status),
            "duration": int(round(result.duration * 1000.0 * 1000.0 * 1000.0)),
        }
        if result.error_message and result.status == "failed":
            error_message = result.error_message
            result_element = self.current_step["result"]
            result_element["error_message"] = error_message
        self._step_index += 1

    def embedding(self, mime_type, data):
        step = self.current_feature_element["steps"][-1]
        step["embeddings"].append(
            {"mime_type": mime_type, "data": base64.b64encode(data).replace("\n", "")}
        )

    def eof(self):
        """
        End of feature
        """
        if not self.current_feature_data:
            return

        self.update_status_data()

        if self.feature_count == 0:
            self.write_json_header()
        else:
            self.write_json_feature_separator()

        self.write_json_feature(self.current_feature_data)
        self.current_feature_data = None
        self.feature_count += 1

    def close(self):
        self.write_json_footer()
        self.close_stream()

    def add_feature_element(self, element):
        assert self.current_feature_data is not None
        if "elements" not in self.current_feature_data:
            self.current_feature_data["elements"] = []
        self.current_feature_data["elements"].append(element)
        return element

    @property
    def current_feature_element(self):
        assert self.current_feature_data is not None
        return self.current_feature_data["elements"][-1]

    @property
    def current_step(self):
        step_index = self._step_index
        if self.current_feature.background is not None:
            element = self.current_feature_data["elements"][-2]
            if step_index >= len(self.current_feature.background.steps):
                step_index -= len(self.current_feature.background.steps)
                element = self.current_feature_element
        else:
            element = self.current_feature_element

        return element["steps"][step_index]

    def update_status_data(self):
        assert self.current_feature
        assert self.current_feature_data
        self.current_feature_data["status"] = self.status(self.current_feature.status)

    def write_tags(self, tags):
        return [
            {"name": tag, "line": tag.line if hasattr(tag, "line") else 1}
            for tag in tags
        ]

    def generate_id(self, feature, scenario=None):
        def convert(name):
            return name.lower().replace(" ", "-")

        id = convert(feature.name)
        if scenario is not None:
            id += ";"
            id += convert(scenario.name)
        return id

    def format_description(self, lines):
        description = "\n".join(lines)
        description = "<pre>%s</pre>" % description
        return description

    def write_json_header(self):
        self.stream.write("[\n")

    def write_json_footer(self):
        self.stream.write("\n]\n")

    def write_json_feature(self, feature_data):
        self.stream.write(json.dumps(feature_data, **self.dumps_kwargs))
        self.stream.flush()

    def write_json_feature_separator(self):
        self.stream.write(",\n\n")


class PrettyCucumberJSONFormatter(CucumberJSONFormatter):
    """
    Provides readable/comparable textual JSON output.
    """

    name = "json.pretty"
    description = "JSON dump of test run (human readable)"
    dumps_kwargs = {"indent": 4, "sort_keys": True}
