/**
 * Created by nafigator on 27.03.2015.
 */

define(['template'], function (template) {
    describe("Template system testing area", function () {

        describe("Template parser component tests", function () {

            it("get RegExp", function () {

                expect(template.getRegExp(['nblock'])).toEqual(new RegExp("{%\\s*\\w+\\s*%}"));
                expect(template.getRegExp(['nblock', 'block', 'value', 'close'])).toEqual(new RegExp(
                    "{%\\s*\\w+\\s*%}|{%\\s*\\.\\s*%}|{{\\s*\\.([:\\w\\(\\)\'\"]+)*\\s*}}|{%\\s*/\\s*%}"
                ));

            });

            it("slice text .", function () {

                expect(template.sliceText("<table>{%table%}</table>", template.getRegExp(['nblock']))).toBe("<table>");
                expect(template.sliceText("<table>", template.getRegExp(['nblock']))).toBe("<table>");
                expect(template.sliceText("{%table%}</table>", template.getRegExp(['nblock']))).toBe("");

                expect(template.sliceText("<table>{%/%}</table>", template.getRegExp(['close']))).toBe("<table>");
                expect(template.sliceText("<table>", template.getRegExp(['close']))).toBe("<table>");
                expect(template.sliceText("{%/%}</table>", template.getRegExp(['close']))).toBe("");

            });

            it("get filters list from construction", function () {
                expect(template.getFilters("{{ name:filter1:filter2:filter3:default('Egor ',5 ,\"Kamenev\") }}")).toEqual([
                    {name: 'filter1', args: []},
                    {name: 'filter2', args: []},
                    {name: 'filter3', args: []},
                    {name: 'default', args: ['Egor ', '5', 'Kamenev']}
                ]);
                expect(template.getFilters("{{ :filter1:filter2:filter3 }}")).toEqual([
                    {name: 'filter1', args: []},
                    {name: 'filter2', args: []},
                    {name: 'filter3', args: []}
                ]);
                expect(template.getFilters("{{ name }}")).toEqual([]);
            });

            it("smart push", function(){

                expect(template.smartPush(undefined, 1)).toEqual([1]);
                expect(template.smartPush([1], 1)).toEqual([1,1]);

            });



        });

        describe("Template parser tests", function () {

            it("works with {% block %}", function () {

                var temp = "<table>{% block %}{% / %}</table>";

                expect(template.parsing(temp)).toEqual({
                    tree: {
                        type: "nblock",
                        name: "block",
                        prependText: "<table>",
                        appendText: "</table>"
                    },
                    template: ""
                });
            })

            it("works with {% . %}", function () {

                var temp = "<table>{% . %}{% / %}</table>";

                expect(template.parsing(temp)).toEqual({
                    tree: {
                        type: "block",
                        name: null,
                        prependText: "<table>",
                        appendText: "</table>"
                    },
                    template: ""
                });
            })

            it("works with {{.}}", function () {

                var temp = "<table>{{.}}</table>";

                expect(template.parsing(temp)).toEqual({
                    tree: {
                        type: "value",
                        filters: [],
                        name: null,
                        prependText: "<table>",
                        appendText: "</table>"
                    },
                    template: ""
                });
            })


            it("works with {{ .:filter }}", function () {
                var temp = "<table><tr><td>{{ .:upper:lower:trim }}</td></tr></table>",
                    data = {name: "egor"};

                expect(template.parsing(temp)).toEqual({
                    tree: {
                        prependText: '<table><tr><td>',
                        type: 'value',
                        filters: [
                            {name: 'upper', args: []},
                            {name: 'lower', args: []},
                            {name: 'trim', args: []},
                        ],
                        name: null,
                        appendText: '</td></tr></table>'
                    },
                    template: ''
                });
            });


        });

        describe("Template evaluate tests", function () {

            var data = {table: [[1, 2, 3], [4, 5, 6]]};

            var tree = {
                type: "nblock",
                name: "table",
                prependText: "<table>",
                appendText: "</table>",
                children: [{
                    type: "block",
                    prependText: "<tr>",
                    appendText: "</tr>",
                    children: [{
                        type: "value",
                        prependText: "<td>",
                        appendText: "</td>"

                    }]
                }]
            };


            it("works with syntactical tree", function () {

                expect(template.evaluate(tree, data)).toBe([
                    "<table>",
                    "<tr>",
                    "<td>1</td>",
                    "<td>2</td>",
                    "<td>3</td>",
                    "</tr>",
                    "<tr>",
                    "<td>4</td>",
                    "<td>5</td>",
                    "<td>6</td>",
                    "</tr>",
                    "</table>"
                ].join(''));


            });

        });

        describe("Template system tests", function () {

            var data = {table: [[1, 2, 3], [4, 5, 6]]};

            var temp = [
                "<table>",
                "{% table %}",
                "<tr>",
                "{% . %}",
                "<td>{{ . }}</td>",
                "{% / %}",
                "</tr>",
                "{% / %}",
                "</table>"
            ].join('');

            var html = [
                "<table>",
                "<tr>",
                "<td>1</td>",
                "<td>2</td>",
                "<td>3</td>",
                "</tr>",
                "<tr>",
                "<td>4</td>",
                "<td>5</td>",
                "<td>6</td>",
                "</tr>",
                "</table>"
            ].join('');


            it("works with ***test job example***", function () {

                expect(template.render(temp, data)).toBe(html);

            });

            it("works with many blocks", function () {

                var tempHard = [
                    "<html>",
                    temp,
                    temp,
                    "</html>"
                ].join('');

                expect(template.render(tempHard, data)).toBe([
                    "<html>",
                    html,
                    html,
                    "</html>"
                ].join(''));

            });

            it("works with partial function execution", function () {

                var tableTemplate = template.render(temp);
                expect(tableTemplate(data)).toBe(html);

            });

            it("works with comments", function () {
                var temp = "<table><tr><td>{# name    asdas dasd a #}</td><td>{# name    asdas dasd a #}</td></tr></table>";
                expect(template.render(temp, {})).toBe(
                    "<table><tr><td></td><td></td></tr></table>"
                );
            });

            it("works with filters", function () {
                var temp = "<table>{% table %}<tr><td>{{ .:lower:capitalize }}</td></tr>{% / %}</table>";
                expect(template.render(temp, {table: ["DAY"]})).toBe(
                    "<table><tr><td>Day</td></tr></table>"
                );
            });

            it("works with hard filters", function () {
                var temp = "<table><tr><td>{{ name:lower:capitalize:default( 'egor' ) }}</td></tr></table>";
                expect(template.render(temp, {table: ["DAY"]})).toBe(
                    "<table><tr><td>egor</td></tr></table>"
                );
            });


            it("works with substitution", function () {
                var temp = "<table><tr><td>{{ name:lower:capitalize }}</td><td>{{ old }}</td></tr></table>",
                    data = {name: "EGOR"};

                expect(template.render(temp, data)).toBe(
                    "<table><tr><td>Egor</td><td></td></tr></table>"
                );
            });

            it("Template 'Em All!", function () {

                var temp = "<table>" +
                    "<tr>\n" +
                    "<th>{{name:lower:upper}}</th>{#This is name column#}\n" +
                    "<th>{{second_name:upper}}</th>{#This is sname column#}\n" +
                    "<th>{{old:upper}}</th>{#This is old column#}\n" +
                    "<th>{{specialization:default('specialization'):upper}}</th>\n" +
                    "</tr>" +
                    "{% programmers%}<tr>{%. %}<td>{{.:lower:capitalize}}</td>{%/ %}</tr>{% /%}" +
                    "{% managers %}<tr>{%. %}<td>{{.:escape:capitalize:trim}}</td>{%/ %}</tr>{% /%}" +
                    "{% other %}<tr>{%. %}<td>{{.:escape:capitalize:trim}}</td>{%/ %}</tr>{% /%}" +
                    "</table>";

                var data = {
                    name: 'Name',
                    second_name: 'Sname',
                    old: 'old',
                    programmers: [
                        ['EGOR', 'Kamenev', 26, 'programmer'],
                        ['andrey', 'ivanov', 36, 'programmer'],
                    ],
                    managers: [
                        ['Vladislav', 'sokolov', 22, 'manager'],
                        ['Sergey', 'Mironov ', 24, 'manager'],
                    ]


                };

                expect(template.render(temp, data)).toBe("<table>" +
                "<tr>\n" +
                "<th>NAME</th>\n" +
                "<th>SNAME</th>\n" +
                "<th>OLD</th>\n" +
                "<th>SPECIALIZATION</th>\n" +
                "</tr>" +
                "<tr>" +
                "<td>Egor</td>" +
                "<td>Kamenev</td>" +
                "<td>26</td>" +
                "<td>Programmer</td>" +
                "</tr>" +
                "<tr>" +
                "<td>Andrey</td>" +
                "<td>Ivanov</td>" +
                "<td>36</td>" +
                "<td>Programmer</td>" +
                "</tr>" +
                "<tr>" +
                "<td>Vladislav</td>" +
                "<td>Sokolov</td>" +
                "<td>22</td>" +
                "<td>Manager</td>" +
                "</tr>" +
                "<tr>" +
                "<td>Sergey</td>" +
                "<td>Mironov</td>" +
                "<td>24</td>" +
                "<td>Manager</td>" +
                "</tr>" +
                "</table>");

                var sendbox = document.createElement('div');
                sendbox.innerHTML = template.render(temp, data);
                document.querySelector('body').appendChild(sendbox);
            });
        });
    });


});
