/* Python Parser for Jison */
/* https://docs.python.org/3.4/reference/lexical_analysis.html */
/* https://docs.python.org/3.4/reference/grammar.html */

/* lexical gammar */
%lex

uppercase               [A-Z]
lowercase               [a-z]
digit                   [0-9]

// identifiers
identifier              ({xid_start})({xid_continue})*
xid_start               ("_")|({uppercase})|({lowercase})
xid_continue            {xid_start}|{digit}

// reserved
operators               ">>="|"<<="|"**="|"//="|"->"|"+="|"-="|"*="|"/="|"%="|
                        "&="|"|="|"^="|"**"|"//"|"<<"|">>"|"<="|">="|"=="|"!="|
                        "("|")"|"["|"]"|"{"|"}"|","|":"|"."|";"|"@"|"="|"+"|"-"|
                        "*"|"/"|"%"|"&"|"|"|"^"|"~"|"<"|">"|"""|"#"|"\"
ellipsis                "..."

// strings
stringliteral           ([rR]|[uU]|[fF]|[fF][rR]|[rR][fF])?({longstring}|{shortstring})

longstring              {longstring_double}|{longstring_single}
longstring_double       '"""'{longstringitem}*?'"""'
longstring_single       "'''"{longstringitem}*?"'''"
longstringitem          {longstringchar}|{escapeseq}
longstringchar          [^\\]

shortstring             {shortstring_double}|{shortstring_single}
shortstring_double      '"'{shortstringitem_double}*'"'
shortstring_single      "'"{shortstringitem_single}*"'"
shortstringitem_double  {shortstringchar_double}|{escapeseq}
shortstringitem_single  {shortstringchar_single}|{escapeseq}
shortstringchar_single  [^\\\n\']
shortstringchar_double  [^\\\n\"]
escapeseq               \\.|\\\n

bytesliteral            {bytesprefix}({longstring}|{shortstring})
bytesprefix             [bB]|[bB][rR]|[rR][bB]

// numbers
integer                 {hexinteger}|{octinteger}|{decinteger}
decinteger              (([1-9]{digit}*)|"0"+)
hexinteger              "0"[x|X]{hexdigit}+
octinteger              "0"[o|O]{octdigit}+
bininteger              "0"[b|B]{bindigit}+
hexdigit                {digit}|[a-fA-F]
octdigit                [0-7]
bindigit                [0|1]

floatnumber             {exponentfloat}|{pointfloat}
pointfloat              {fraction}|{intpart}{fraction}|{intpart}"."
exponentfloat           ({digit}+|{pointfloat}){exponent}
intpart                 {digit}+
fraction                "."{digit}+
exponent                [e|E][\+|\-]?({digit})+
imagnumber              ({floatnumber}|{intpart})[jJ]

%s INITIAL DEDENTS INLINE

%%

<INITIAL,INLINE><<EOF>> %{ 
                            // if the last statement in indented, need to force a dedent before EOF
                            if (this.indents == undefined) this.indents == [0];
                            if (this.indents.length > 1) { 
                               this.begin( 'DEDENTS' ); 
                               this.unput(' '); // make sure EOF is not triggered 
                               this.dedents = 1; 
                               this.indents.pop();
                            } else { 
                                return 'EOF'; 
                            } 
                        %}
<INITIAL>\              %{ if (this.indent == undefined) this.indent = 0; this.indent += 1 %}
<INITIAL>\t             %{ if (this.indent == undefined) this.indent = 0; this.indent = ( this.indent + 8 ) & -7 %}
<INITIAL>\n             %{ this.indent = 0 %} // blank line
<INITIAL>\#[^\n]*       /* skip comments */
<INITIAL>.              %{ 
                            this.unput( yytext )
                            if (this.indents == undefined) this.indents = [0];
                            var last = this.indents[ this.indents.length - 1 ]
                            if (this.indent == undefined) this.indent = 0;
                            if ( this.indent > last ) {
                                this.begin( 'INLINE' )
                                this.indents.push( this.indent )
                                return 'INDENT'
                            } else if ( this.indent < last ) {
                                this.begin( 'DEDENTS' )
                                this.dedents = 0 // how many dedents occured
                                while( this.indents.length ) {
                                    this.dedents += 1
                                    this.indents.pop()
                                    last = this.indents[ this.indents.length - 1 ]
                                    if ( last == this.indent ) break
                                }
                                if ( !this.indents.length ) {
                                    throw new Error( "TabError: Inconsistent" )
                                }
                            } else {
                                this.begin( 'INLINE' )
                            }
                        %}
<DEDENTS>.              %{
                            this.unput( yytext )
                            if (this.dedents == undefined) this.dedents = 0;
                            if ( this.dedents-- > 0 ) {
                                return 'DEDENT'
                            } else {
                                this.begin( 'INLINE' )
                            }
                        %}

<INLINE>\n              %{
                            // implicit line joining
                            if (this.brackets_count == undefined) this.brackets_count = 0;
                            if ( this.brackets_count <= 0 ) {
                                this.indent = 0; 
                                this.begin( 'INITIAL' )
                                return 'NEWLINE'
                            }
                        %}

<INLINE>\#[^\n]*        /* skip comments */
<INLINE>\\\n[\ \t\f]*   /* skip line continuations */
<INLINE>[\ \t\f]+       /* skip whitespace, separate tokens */
/* floatnumber rules should go before operators. Otherwise .\d+ will never be read as a floating
 * point number, the '.' will only be used for property accesses. */
<INLINE>{ellipsis}      return 'ELLIPSIS'
<INLINE>{imagnumber}    return 'NUMBER'
<INLINE>{floatnumber}   return 'NUMBER'
<INLINE>{bininteger}    %{
                            var i = yytext.substr(2); // binary val
                            yytext = 'parseInt("'+i+'",2)'
                            return 'NUMBER'
                        %}
<INLINE>{integer}       return 'NUMBER'
<INLINE>{operators}     %{
                            if (this.brackets_count == undefined) this.brackets_count = 0;
                            if ( yytext == '{' || yytext == '[' || yytext == '(' ) {
                                this.brackets_count += 1
                            } else if ( yytext == '}' || yytext == ']' || yytext == ')' ) {
                                this.brackets_count -= 1
                            }
                            return yytext 
                        %}
<INLINE>{stringliteral} %{
                            // escape string and convert to double quotes
                            // http://stackoverflow.com/questions/770523/escaping-strings-in-javascript
                            if (yytext.endsWith("'''") || yytext.endsWith('"""')) {
                                var str = yytext.substr(3, yytext.length-6)
                                    .replace( /[\\"']/g, '\\$&' )
                                    .replace(/\u0000/g, '\\0');
                                yytext = '"' + str + '"'
                            }
                            return 'STRING'
                        %}
<INLINE>{bytesliteral} %{
                            // escape string and convert to double quotes
                            // http://stackoverflow.com/questions/770523/escaping-strings-in-javascript
                            if (yytext.endsWith("'''") || yytext.endsWith('"""')) {
                                var str = yytext.substr(3, yytext.length-6)
                                    .replace( /[\\"']/g, '\\$&' )
                                    .replace(/\u0000/g, '\\0');
                                yytext = '"' + str + '"'
                            }
                            return 'BYTES'
                        %}
<INLINE>{identifier}    %{
                            this.keywords = [
                                "continue", "nonlocal", "finally", "lambda", "return", "assert",
                                "global", "import", "except", "raise", "break", "False", "class",
                                "while", "yield", "None", "True", "from", "with", "elif", "else",
                                "pass", "for", "try", "def", "and", "del", "not", "is", "as", "if",
                                "or", "in"
                            ]
                            return ( this.keywords.indexOf( yytext ) == -1 )
                                ? 'NAME'
                                : yytext;
                        %}

/lex

%start expressions

%%


/** grammar **/
expressions
    : file_input        { return $1 }
    ;

// file_input: (NEWLINE | stmt)* ENDMARKER
file_input
    : EOF
    | file_input0 EOF    { $$ = { type: 'module', code: $1, location: @$ } }
    ;

file_input0
    : NEWLINE
    | stmt
        { $$ = $1 }
    | NEWLINE file_input0
        { $$ = $2 }
    | stmt file_input0
        { $$ = $1.concat( $2 ) }
    ;

// decorator: '@' dotted_name [ '(' [arglist] ')' ] NEWLINE
decorator
    : '@' dotted_name NEWLINE
        { $$ = { type: 'decorator', decorator: $2, location: @$ } }
    | '@' dotted_name '(' ')' NEWLINE
        { $$ = { type: 'decorator', decorator: $2, args: '()', location: @$ } }
    | '@' dotted_name '(' arglist ')' NEWLINE
        { $$ = { type: 'decorator', decorator: $2, args: $4, location: @$ } }
    ;

// decorators: decorator+
decorators
    : decorator
        { $$ = [ $1 ] }
    | decorator decorators
        { $$ = [ $1 ].concat( $2 ) }
    ;

// decorated: decorators (classdef | funcdef)
decorated
    : decorators classdef
        { $$ = { type: 'decorate', decorators: $1, def: $2, location: @$ } }
    | decorators funcdef
        { $$ = { type: 'decorate', decorators: $1, def: $2, location: @$ } }
    ;

// funcdef: 'def' NAME parameters ['->' test] ':' suite
funcdef
    : 'def' NAME parameters ':' suite
        { $$ = { type: 'def', name: $2, params: $3, code: $5, location: @$ } }
    | 'def' NAME parameters '->' test ':' suite
        { $$ = { type: 'def', name: $2, params: $3, code: $7, annot: $5, location: @$ } }
    ;

// parameters: '(' [typedargslist] ')'
parameters
    : '(' ')'
        { $$ = [] }
    | '(' typedargslist ')'
        { $$ = $2 }
    ;

// typedargslist: (tfpdef ['=' test] 
//    (',' tfpdef ['=' test])* 
//    [','  ['*' [tfpdef] (',' tfpdef ['=' test])* [',' '**' tfpdef] | '**' tfpdef]]
//   |  '*' [tfpdef] (',' tfpdef ['=' test])* [',' '**' tfpdef] | '**' tfpdef)
typedargslist
    : typedarglist_part
        { $$ = [ $1 ] }
    | typedarglist_part ','
        { $$ = [ $1 ] }
    | typedarglist_part ',' typedargslist
        { $$ = [ $1 ].concat($3) }
    ;

typedarglist_part
    : tfpdef
        { $$ = [ $1 ] }
    | tfpdef '=' test
        { $1.default = $3; $$ = [ $1 ] }
    | '*' 
        { $$ = { name: '', star: true } }
    | '*' tfpdef
        { $$ = [ { name: $2, star: true } ] }
    | '**' tfpdef
        {  $$ = [ {name: $2, starstar: true} ] }
    ;

// tfpdef: NAME [':' test]
tfpdef
    : NAME
        { $$ = { name: $1 } }
    | NAME ':' test
        { $$ = { name: $1, anno: $3 } }
    ;

// varargslist: NOTE to keep the grammar LALR, we approximate
varargslist
    : varargspart
        { $$ = [$1] }
    | varargspart ','
        { $$ = [$1] }
    | varargspart ',' varargslist
        { $$ = [$1].concat($3) }
    ;

varargspart
    : vfpdef
        { $$ = [{ name: $1}] }
    | vfpdef '='test
        { $$ = [{ name: $1, default_value: $3}] }
    | '*'
        { $$ = [{ name: '', star: true}] }
    | '*' vfpdef
        { $$ = [{ name: $2, star: true}] }
    | '**' vfpdef
        { $$ = [{ name: $2, starstar: true}] }
    ;

// vfpdef: NAME
vfpdef: NAME;

// stmt: simple_stmt | compound_stmt
stmt
    : simple_stmt 
        { $$ = $1 }
    | compound_stmt
        { $$ = [$1] }
    ;

// simple_stmt: small_stmt (';' small_stmt)* [';'] NEWLINE
simple_stmt
    : small_stmt NEWLINE
        { $$ = [$1] }
    | small_stmt ';' NEWLINE
        { $$ = [$1] }
    | small_stmt simple_stmt0 NEWLINE
        { $$ = [ $1 ].concat( $2 ) }
    ;

simple_stmt0
    : ';' small_stmt
        { $$ = [ $2 ] }
    | ';' small_stmt ';'
        { $$ = [ $2 ] }
    | ';' small_stmt simple_stmt0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// small_stmt: (expr_stmt | del_stmt | pass_stmt | flow_stmt |
//              import_stmt | global_stmt | nonlocal_stmt | assert_stmt)
small_stmt: expr_stmt | del_stmt | pass_stmt | flow_stmt | import_stmt |
            global_stmt | nonlocal_stmt | assert_stmt;

// expr_stmt: testlist_star_expr (augassign (yield_expr|testlist) |
//  ('=' (yield_expr|testlist_star_expr))*)
expr_stmt
    : testlist_star_expr
        { $$ = $1.length == 1 ? $1[0] : { type: 'tuple', items: $1, location: @$ } }
    | testlist_star_expr augassign yield_expr
        { $$ = { type: 'assign', op: $2, targets: $1, sources: $3, location: @$ } }
    | testlist_star_expr augassign testlist
        { $$ = { type: 'assign', op: $2, targets: $1, sources: $3, location: @$ } }
    | testlist_star_expr assignlist
        { $$ = { type: 'assign', targets: $1.concat($2.targets), sources: $2.sources, location: @$ } }
    ;

assignlist
    : '=' yield_expr
        { $$ = { targets: [], sources: [$2] } }
    | '=' yield_expr assignlist
        { $$ = { targets: $3, sources: [$2] } }
    | '=' testlist_star_expr
        { $$ = { targets: [], sources: [$2] } }
    | '=' testlist_star_expr assignlist
        { $$ = { targets: $2.concat($3.targets), sources: $3.sources } }
    ;

// testlist_star_expr: (test|star_expr) (',' (test|star_expr))* [',']
testlist_star_expr
    : test
        { $$ = [ $1 ] }
    | test ','
        { $$ = [ $1 ] }
    | test testlist_star_expr0
        { $$ = [ $1 ].concat( $2 ) }
    | star_expr
        { $$ = [ $1 ] }
    | star_expr ','
        { $$ = [ $1 ] }
    | star_expr testlist_star_expr0
        { $$ = [ $1 ].concat( $2 ) }
    ;

testlist_star_expr0
    : ',' test
        { $$ = [ $2 ] }
    | ',' test ','
        { $$ = [ $2 ] }
    | ',' test testlist_star_expr0
        { $$ = [ $2 ].concat( $3 ) }
    | ',' star_expr
        { $$ = [ $2 ] }
    | ',' star_expr ','
        { $$ = [ $2 ] }
    | ',' star_expr testlist_star_expr0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// augassign: ('+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' |
//   '<<=' | '>>=' | '**=' | '//=')
augassign
    : '+='
    | '-='
    | '*='
    | '/='
    | '%='
    | '&='
    | '|='
    | '^='
    | '<<='
    | '>>='
    | '**='
    | '//='
    ;

// del_stmt: 'del' exprlist
del_stmt
    : 'del' exprlist
        { $$ = {type:'del', name: $1, location: @$} }
    ;

// pass_stmt: 'pass'
pass_stmt
    : 'pass' 
        { $$ = {type:'pass', location: @$} }
    ;

// flow_stmt: break_stmt | continue_stmt | return_stmt | raise_stmt | yield_stmt
flow_stmt: break_stmt | continue_stmt | return_stmt | raise_stmt | yield_stmt;

// break_stmt: 'break'
break_stmt
    : 'break' 
        { $$ = {type:'break', location: @$} }
    ;

// continue_stmt: 'continue'
continue_stmt
    : 'continue'
        { $$ = {type:'continue', location: @$} }
    ;

// return_stmt: 'return' [testlist]
return_stmt
    : 'return'
        { $$ = {type:'return', location: @$} }
    | 'return' testlist
        { $$ = {type:'return', value:$2, location: @$} }
    ;

// yield_stmt: yield_expr
yield_stmt
    : yield_expr
    ;

// raise_stmt: 'raise' [test ['from' test]]
raise_stmt
    : 'raise'
        { $$ = {type: 'raise', location: @$} }
    | 'raise' test
        { $$ = {type: 'raise', err: $2, location: @$ } }
    | 'raise' test 'from' test
        { 
            $$ = { type: 'raise',  err: $2, location: @$  }
        }
    ;

// import_stmt: import_name | import_from
import_stmt
    : import_name | import_from ;

// import_name: 'import' dotted_as_names
import_name
    : 'import' dotted_as_names
        { $$ = {type: 'import', names: $2, location: @$ } }
    ;

// import_from: ('from' (('.' | '...')* dotted_name | ('.' | '...')+)
//  'import' ('*' | '(' import_as_names ')' | import_as_names))
import_from
    : 'from' dotted_name 'import' import_from_tail
        { $$ = { type: 'from',  base: $2, imports: $4, location: @$ } }
    | 'from' import_from0 dotted_name 'import' import_from_tail
        { $$ = { type: 'from',  base: $2 + $3, imports: $5, location: @$ } }
    | 'from' import_from0 'import' import_from_tail
    ;

// note below: the ('.' | '...') is necessary because '...' is tokenized as ELLIPSIS
import_from0
    : '.'
    | '.' import_from0
        { $$ = $1 + $2 }
    | ELLIPSIS
    | ELLIPSIS import_from0
        { $$ = $1 + $2 }
    ;

import_from_tail
    : '*' // todo: behavior not defined
    | '(' import_as_names ')'
        { $$ = $2 }
    | import_as_names
    ;

// import_as_name: NAME ['as' NAME]
import_as_name
    : NAME
        { $$ = { path: $1, location: @$ } }
    | NAME 'as' NAME
        { $$ = { path: $1, name: $3, location: @$ } }
    ;

// dotted_as_name: dotted_name ['as' NAME]
dotted_as_name
    : dotted_name
        { $$ = { path: $1, location: @$ } }
    | dotted_name 'as' NAME
        { $$ = { path: $1, name: $3, location: @$ } }
    ;

// import_as_names: import_as_name (',' import_as_name)* [',']
import_as_names
    : import_as_name
        { $$ = [ $1 ] }
    | import_as_name ','
        { $$ = [ $1 ] }
    | import_as_name import_as_names0
        { $$ = [ $1 ].concat( $2 ) }
    ;

import_as_names0
    : ',' import_as_name
        { $$ = [ $2 ] }
    | ',' import_as_name ','
        { $$ = [ $2 ] }
    | ',' import_as_name import_as_names0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// dotted_as_names: dotted_as_name (',' dotted_as_name)*
dotted_as_names
    : dotted_as_name
        { $$ = [ $1 ] }
    | dotted_as_name dotted_as_names0
        { $$ = [ $1 ].concat( $2 ) }
    ;

dotted_as_names0
    : ',' dotted_as_name
        { $$ = [ $2 ] }
    | ',' dotted_as_name dotted_as_names0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// dotted_name: NAME ('.' NAME)*
dotted_name
    : NAME
    | NAME dotted_name0
        { $$ = $1 + $2 }
    ;

dotted_name0
    : '.' NAME
        { $$ = $1 + $2 }
    | '.' NAME dotted_name0
        { $$ = $1 + $2 + $3 }
    ;

// global_stmt: 'global' NAME (',' NAME)*
// todo: behavior undefined (maybe use to avoid setting a 'assign' within the scope)
global_stmt
    : 'global' NAME
        { $$ = { type: 'global', names: [$2], location: @$ } }
    | 'global' NAME global_stmt0
        { $$ = { type: 'global', names: $2, location: @$ } }
    ;

global_stmt0
    : ',' NAME
        { $$ = [$2] }
    | ',' NAME global_stmt0
        { $$ = [$2].concat($3) }
    ;

// nonlocal_stmt: 'nonlocal' NAME (',' NAME)*
// todo: behavior undefined (maybe use to avoid setting a 'assign' within the scope)
nonlocal_stmt
    : 'nonlocal' NAME
        { $$ = { type: 'nonlocal', names: [$2], location: @$ } }
    | 'nonlocal' NAME nonlocal_stmt0
        { $$ = { type: 'nonlocal', names: $2, location: @$ } }
    ;

nonlocal_stmt0
    : ',' NAME
        { $$ = [$2] }
    | ',' NAME nonlocal_stmt0
        { $$ = [$2].concat($3) }
    ;

// assert_stmt: 'assert' test [',' test]
assert_stmt
    : 'assert' test
        { $$ = { type: 'assert',  cond: $2, location: @$ } }
    | 'assert' test ',' test
        { $$ = { type: 'assert',  cond: $2, err: $4, location: @$ } }
    ;

// compound_stmt: if_stmt | while_stmt | for_stmt | try_stmt | with_stmt |
//                funcdef | classdef | decorated
compound_stmt:  if_stmt | while_stmt | for_stmt | try_stmt | with_stmt | 
                funcdef | classdef | decorated;

// if_stmt: 'if' test ':' suite ('elif' test ':' suite)* ['else' ':' suite]
if_stmt
    : 'if' test ':' suite
        { $$ = { type: 'if',  cond: $2, code: $4, location: @$ } }
    | 'if' test ':' suite else_part
        { 
            $$ = { type: 'if', cond: $2, code: $4, else: $5, location: @$ }
        }
    | 'if' test ':' suite if_stmt0
        {
            $$ = { type: 'if', cond: $2, code: $4, elif: $5, location: @$ }
        }
    | 'if' test ':' suite if_stmt0 else_part
        {
            $$ = { type: 'if', cond: $2, code: $4, elif: $5, else: $6, location: @$ }
        }
    ;

if_stmt0
    : 'elif' test ':' suite
        { $$ = [ { cond: $2, code: $4 } ] }
    | 'elif' test ':' suite if_stmt0
        { $$ = [ { cond: $2, code: $4 } ].concat( $5 ) }
    ;

else_part
    : 'else' ':' suite
        { $$ = { type: 'else', code: $3, location: @$ } }
    ;

// while_stmt: 'while' test ':' suite ['else' ':' suite]
while_stmt
    : 'while' test ':' suite
        { $$ = { type: 'while',  cond: $2, code: $4, location: @$ } }
    | 'while' test ':' suite 'else' ':' suite
        { $$ = { type: 'while',  cond: $2, code: $4, else: $7, location: @$ } }
    ;

// for_stmt: 'for' exprlist 'in' testlist ':' suite ['else' ':' suite]
for_stmt
    : 'for' exprlist 'in' testlist colon suite
        { $$ = { type: 'for',  target: $2, iter: $4, code: $6, location: @$,
            decl_location: {
                first_line: @$.first_line,
                first_column: @$.first_column,
                last_line: $5.location.last_line,
                last_column: $5.location.last_column
            } } }
    | 'for' exprlist 'in' testlist colon suite 'else' ':' suite
        { $$ = { type: 'for',  target: $2, iter: $4, code: $6, else: $9, location: @$,
            decl_location: {
                first_line: @$.first_line,
                first_column: @$.first_column,
                last_line: $5.location.last_line,
                last_column: $5.location.last_column
            } } }
    ;

// try_stmt: ('try' ':' suite
//   ((except_clause ':' suite)+
//    ['else' ':' suite]
//    ['finally' ':' suite] |
//     'finally' ':' suite))
try_stmt
    : 'try' ':' suite 'finally' ':' suite
        { $$ = { type: 'try',  code: $3, finally: $6, location: @$ } }
    | 'try' ':' suite try_excepts
        { $$ = { type: 'try',  code: $3, excepts: $4, location: @$ } }
    | 'try' ':' suite try_excepts 'finally' ':' suite
        { $$ = { type: 'try',  code: $3, excepts: $4, finally: $7, location: @$ } }
    | 'try' ':' suite try_excepts 'else' ':' suite
        { $$ = { type: 'try',  code: $3, excepts: $4, else: $7, location: @$ } }
    | 'try' ':' suite try_excepts 'else' ':' suite 'finally' ':' suite
        { $$ = { type: 'try',  code: $3, excepts: $4, else: $7, finally: $10, location: @$ } }
    ;

try_excepts
    : except_clause ':' suite
        { $1.code = $3; $$ = [ $1 ] }
    | except_clause ':' suite try_excepts
        { $1.code = $3; $$ = [ $1 ].concat( $4 ) }
    ;

// except_clause: 'except' [test ['as' NAME]]
// make sure that the default except clause is last
except_clause
    : 'except'
        { $$ = { cond: null } }
    | 'except' test
        { $$ = { cond: $2 } }
    | 'except' test 'as' NAME
        { $$ = { cond: $2, name: $4 } }
    ;

// with_stmt: 'with' with_item (',' with_item)*  ':' suite
with_stmt
    : 'with' with_item ':' suite
        { $$ = { type: 'with',  items: [ $2 ], code: $4, location: @$ } }
    | 'with' with_item with_stmt0 ':' suite
        { 
            $2 = [ $2 ].concat( $3 )
            $$ = { type: 'with', items: $2, code: $5, location: @$ }
        }
    ;

with_stmt0
    : ',' with_item
        { $$ = [ $2 ] }
    | ',' with_item with_stmt0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// with_item: test ['as' expr]
with_item
    : test
        { $$ = { with: $1, as: $1 } }
    | test 'as' expr
        { $$ = { with: $1, as: $3 } }
    ;

// suite: simple_stmt | NEWLINE INDENT stmt+ DEDENT
suite
    : simple_stmt
        { $$ = $1 }
    | NEWLINE INDENT suite0 DEDENT
        { $$ = $3 }
    ;

suite0
    : stmt
        { $$ = $1 }
    | stmt suite0
        { $$ = $1.concat( $2 ) }
    ;

// test: or_test ['if' or_test 'else' test] | lambdef
test
    : or_test
    | or_test 'if' or_test 'else' test
        { $$ = {type:'ifexpr', test: $1, then:$3, else: $5, location: @$ } }
    | lambdef
    ;

// test_nocond: or_test | lambdef_nocond
test_nocond: or_test | lambdef_nocond ;

// lambdef: 'lambda' [varargslist] ':' test
lambdef
    : 'lambda' ':' test
        { $$ = { type: 'lambda',  args: '', code: $3, location: @$ } }
    | 'lambda' varargslist ':' test
        { $$ = { type: 'lambda',  args: $2, code: $3, location: @$ } }
    ;

// lambdef_nocond: 'lambda' [varargslist] ':' test_nocond
lambdef_nocond
    : 'lambda' ':' test_nocond
    | 'lambda' varargslist ':' test_nocond
    ;

// or_test: and_test ('or' and_test)*
or_test
    : and_test
    | and_test or_test0
        { $$ = $2($1) }
    ;

or_test0
    : 'or' and_test
        { loc = @$; $$ = function (left) { return { type: 'binop', op: $1, left: left, right: $2, location: loc }; } }
    | 'or' and_test or_test0
        { loc = @$; $$ = function (left) { return $3({ type: 'binop', op: $1, left: left, right: $2, location: loc }); } }
    ;

// and_test: not_test ('and' not_test)*
and_test
    : not_test
    | not_test and_test0
        { $$ = $2($1) }
    ;

and_test0
    : 'and' not_test
        { loc = @$; $$ = function (left) { return { type: 'binop', op: $1, left: left, right: $2, location: loc }; } }
    | 'and' not_test and_test0
        { loc = @$; $$ = function (left) { return $3({ type: 'binop', op: $1, left: left, right: $2, location: loc }); } }
    ;

// not_test: 'not' not_test | comparison
not_test
    : 'not' not_test
        { $$ = { type: 'unop', op: $1, operand: $2, location: @$ } }
    | comparison
    ;

// comparison: expr (comp_op expr)*
comparison
    : expr
    | expr comparison0
        { $$ = $2($1) }
    ;

comparison0
    : comp_op expr
        { loc=@$; $$ = function (left) { return { type: 'binop', op: $1, left: left, right: $2, location: loc }; } }
    | comp_op expr comparison0
        { loc=@$; $$ = function (left) { return $3({ type: 'binop', op: $1, left: left, right: $2, location: loc }); } }
    ;

// comp_op: '<'|'>'|'=='|'>='|'<='|'<>'|'!='|'in'|'not' 'in'|'is'|'is' 'not'
// NOTE: '<>' is removed because we don't need to support __future__
comp_op: '<'|'>'|'=='|'>='|'<='|'!='
    |'in'
    |'not' 'in'
        { $$ = $1+$2 }
    |'is'
    |'is' 'not'
        { $$ = $1+$2 }
    ;

// star_expr: '*' expr
star_expr
    : '*' expr 
        { $$ = { type:'starred', value: $1, location: @$ } }
    ;

// expr: xor_expr ('|' xor_expr)*
expr
    : xor_expr
    | xor_expr expr0
        { $$ = $2($1) }
    ;

expr0
    : '|' xor_expr
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '|' xor_expr expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// xor_expr: and_expr ('^' and_expr)*
xor_expr
    : and_expr
    | and_expr xor_expr0
        { $$ = $2($1) }
    ;

xor_expr0
    : '^' and_expr
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '^' and_expr xor_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// and_expr: shift_expr ('&' shift_expr)*
and_expr
    : shift_expr
    | shift_expr and_expr0
        { $$ = $2($1) }
    ;

and_expr0
    : '&' shift_expr
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '&' shift_expr and_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// shift_expr: arith_expr (('<<'|'>>') arith_expr)*
shift_expr
    : arith_expr
    | arith_expr shift_expr0
        { $$ = $2($1) }
    ;

shift_expr0
    : '<<' arith_expr
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '<<' arith_expr shift_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    | '>>' arith_expr
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '>>' arith_expr shift_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// arith_expr: term (('+'|'-') term)*
arith_expr
    : term
    | term arith_expr0
        { $$ = $2($1) }
    ;

arith_expr0
    : '+' term
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '+' term arith_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    | '-' term
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '-' term arith_expr0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// term: factor (('*'|'/'|'%'|'//') factor)*
term
    : factor
    | factor term0
        { $$ = $2($1) }
    ;

term0
    : '*' factor
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '*' factor term0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    | '/' factor
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '/' factor term0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    | '%' factor
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '%' factor term0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    | '//' factor
        { loc = @$; $$ = function (left) { return {type:'binop', op:$1, left: left, right: $2, location: loc }; } }
    | '//' factor term0
        { loc = @$; $$ = function (left) { return $3({type:'binop', op:$1, left: left, right: $2, location: loc }); } }
    ;

// factor: ('+'|'-'|'~') factor | power
factor
    : '+' factor
        { $$ = {type:'unop', op:$1, operand:$2, location: @$} }
    | '-' factor
        { $$ = {type:'unop', op:$1, operand:$2, location: @$} }
    | '~' factor
        { $$ = {type:'unop', op:$1, operand:$2, location: @$} }
    | power
    ;

// power: atom trailer* ['**' factor]
power
    : atom_expr
    | atom_expr '**' factor
        { $$ = {type: 'binop', op:$2, left: $1, right: $3, location: @$} }
    ;

trailer_list
    : trailer
    | trailer trailer_list
        { $$ = function (left) { return $2($1(left)) } }
    ;

atom_expr
    : atom
    | atom trailer_list
        { partial = $2($1); partial.location = @$; $$ = partial; }
    ;

// atom: ('(' [yield_expr|testlist_comp] ')' |
//        '[' [testlist_comp] ']' |
//        '{' [dictorsetmaker] '}' |
//        NAME | NUMBER | STRING+ | '...' | 'None' | 'True' | 'False')
atom
    : '(' ')'
        { $$ = { type: 'tuple', items: [], location: @$ } }
    | '(' yield_expr ')'
        { $$ = { type: 'yieldexpr', value: $2, location: @$ } }
    | '(' testlist_comp ')'
        { $$ = { type: 'tuple', items: $2, location: @$ } }
    | '[' ']'
        { $$ = { type: 'list', items: [], location: @$ } }
    | '[' testlist_comp ']'
        { $$ = { type: 'list',  items: $2, location: @$ } }
    | '{' '}'
        { $$ = { type: 'dict',  entries: [], location: @$ } }
    | '{' dictorsetmaker '}'
        { $$ = { type: $2.type, entries: $2.entries, comp_for: $2.comp_for, location: @$ } }
    | NAME
        { $$ = { type: 'name', id: $1, location: @$ } }
    | NUMBER
        { $$ = { type: 'literal', value: $1 * 1, location: @$ } } // convert to number
    | string
        { $$ = { type: 'literal', value: $1, location: @$ } }
    | bytes
        { $$ = { type: 'literal', value: $1, location: @$ } }
    | ELLIPSIS
        { $$ = { type: 'literal', value: { type: 'ellipsis' }, location: @$ } }
    | 'None'
        { $$ = { type: 'literal', value: 'None', location: @$ } }
    | 'True'
        { $$ = { type: 'literal', value: 'True', location: @$} }
    | 'False'
        { $$ = { type: 'literal', value: 'False', location: @$} }
    ;

string
    : STRING
    | STRING string
        { $$ = $1 + $2 }
    ;

bytes
    : BYTES
    | BYTES bytes
        { $$ = $1 + $2 }
    ;

colon: ':' { $$ = { location: @$ } } ;

// testlist_comp: (test|star_expr) ( comp_for | (',' (test|star_expr))* [','] )
testlist_comp
    : test
        { $$ = [ $1 ] }
    | test ','
        { $$ = [ $1 ] }
    | test testlist_comp_tail
        { $$ = [ $1 ].concat( $2 ) }
    | star_expr
        { $$ = [ $1 ] }
    | star_expr ','
        { $$ = [ $1 ] }
    | star_expr testlist_comp_tail
        { $$ = [ $1 ].concat( $2 ) }
    ;

testlist_comp_tail
    : comp_for
    | testlist_comp_tail0
    ;

testlist_comp_tail0
    : ',' test
        { $$ = [ $2 ] }
    | ',' test ','
        { $$ = [ $2 ] }
    | ',' test testlist_comp_tail0
        { $$ = [ $2 ].concat( $3 ) }
    | ',' star_expr
        { $$ = [ $2 ] }
    | ',' star_expr ','
        { $$ = [ $2 ] }
    | ',' star_expr testlist_comp_tail0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// trailer: '(' [arglist] ')' | '[' subscriptlist ']' | '.' NAME
trailer
    : '(' ')'
        { loc = @$; $$ = function (left) { return {type: 'call', func: left, args: [], location: loc }; } }
    | '(' arglist ')'
        { loc = @$; $$ = function (left) { return {type: 'call', func: left, args: $2, location: loc }; } }
    | '[' ']'
        { loc = @$; $$ = function (left) { return {type: 'index', value: left, args: [], location: loc }; } }
    | '[' subscriptlist ']'
        { loc = @$; $$ = function (left) { return {type: 'index', value: left, args: $2, location: loc }; } }
    | '.' NAME
        { loc = @$; $$ = function (left) { return {type: 'dot', value: left, name: $2, location: loc }; } }
    ;

// subscriptlist: subscript (',' subscript)* [',']
subscriptlist
    : subscript
        { $$ = [ $1 ] }
    | subscript ','
        { $$ = [ $1 ] }
    | subscript subscriptlist0
        { $$ = [ $1 ].concat( $2 ) }
    ;

subscriptlist0
    : ',' subscript
        { $$ = [ $2 ] }
    | ',' subscript ','
        { $$ = [ $2 ] }
    | ',' subscript subscriptlist0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// subscript: test | [test] ':' [test] [sliceop]
subscript
    : test
    | test ':' test sliceop
        { $$ = { type: 'slice', start: $1, stop: $3, step: $4 } }
    | test ':' test
        { $$ = { type: 'slice', start: $1, stop: $3 } }
    | test ':' sliceop
        { $$ = { type: 'slice', start: $1, step: $3 } }
    | test ':'
        { $$ = { type: 'slice', start: $1 } }
    | ':' test sliceop
        { $$ = { type: 'slice', stop: $2, step: $3 } }
    | ':' test
        { $$ = { type: 'slice', stop: $2 } }
    | ':' sliceop
        { $$ = { type: 'slice', step: $2 } }
    | ':'
        { $$ = { type: 'slice' } }
    ;

// sliceop: ':' [test]
sliceop
    : ':'
        { $$ = undefined } 
    | ':' test
        { $$ = $2 }
    ;

// exprlist: (expr|star_expr) (',' (expr|star_expr))* [',']
exprlist
    : expr
        { $$ = [$1] }
    | expr ','
        { $$ = [$1] }
    | expr exprlist0
        { $$ = [$1].concat($2) }
    | star_expr
        { $$ = [$1] }
    | star_expr ','
        { $$ = [$1] }
    | star_expr exprlist0
        { $$ = $1.concat($2) }
    ;

exprlist0
    : ',' expr
        { $$ = [$2] }
    | ',' expr ','
        { $$ = [$2] }
    | ',' expr exprlist0
        { $$ = [$2].concat($3) }
    | ',' star_expr
        { $$ = [$2] }
    | ',' star_expr ','
        { $$ = [$2] }
    | ',' star_expr exprlist0
        { $$ = $2.concat($3) }
    ;

// testlist: test (',' test)* [',']
testlist
    : test
        { $$ = [ $1 ] }
    | test ','
        { $$ = [ $1 ] }
    | test testlist0
        { $$ = [ $1 ].concat( $2 ) }
    ;

testlist0
    : ',' test
        { $$ = [ $2 ] }
    | ',' test ','
        { $$ = [ $2 ] }
    | ',' test testlist0
        { $$ = [ $2 ].concat( $3 ) }
    ;

// dictorsetmaker: ( (test ':' test (comp_for | (',' test ':' test)* [','])) |
//   (test (comp_for | (',' test)* [','])) )
dictorsetmaker
    : test ':' test
        { $$ = { type: 'dict', entries: [{ k: $1, v: $3 }] } }
    | test ':' test ','
        { $$ = { type: 'dict', entries: [{ k: $1, v: $3 }] } }
    | test ':' test comp_for
        { $$ = { type: 'dict', entries: [{ k: $1, v: $3 }], comp_for: $4 } }
    | test ':' test dictmaker
        { $$ = { type: 'dict', entries: [{ k: $1, v: $3 }].concat( $4 ) } }
    | test
        { $$ = { type: 'set', entries: [ $1 ] } }
    | test ','
        { $$ = { type: 'set', entries: [ $1 ] } }
    | test comp_for
        { $$ = { type: 'set', entries: [ $1 ], comp_for: $2 } }
    | test setmaker
        { $$ = { type: 'set', entries: [ $1 ].concat( $2 ) } }
    ;

dictmaker
    : ',' test ':' test
        { $$ = [{ k: $2, v: $4 }] }
    | ',' test ':' test ','
        { $$ = [{ k: $2, v: $4 }] }
    | ',' test ':' test dictmaker
        { $$ = [{ k: $2, v: $4 }].concat( $5 ) }
    ;

setmaker
    : ',' test
        { $$ = [ $2 ] }
    | ',' test ','
        { $$ = [ $2 ] }
    | ',' test setmaker
        { $$ = [ $2 ].concat( $3 ) }
    ;

// classdef: 'class' NAME ['(' [arglist] ')'] ':' suite
classdef
    : 'class' NAME ':' suite
        { $$ = { type: 'class',  name: $2, code: $4, location: @$ } }
    | 'class' NAME '(' ')' ':' suite
        { $$ = { type: 'class',  name: $2, code: $6, location: @$ } }
    | 'class' NAME '(' arglist ')' ':' suite
        { $$ = { type: 'class',  name: $2, code: $7, extends: $4, location: @$ } }
    ;

// arglist: (argument ',')* (argument [',']
//  |'*' test (',' argument)* [',' '**' test] 
//  |'**' test)
arglist
    : argument
        { $$ = [ $1 ] }
    | argument ','
        { $$ = [ $1 ] }
    | argument arglist0
        { $$ = [ $1 ].concat( $2 ) }
    ;

arglist0
    : ',' argument
        { $$ = [ $2 ] }
    | ',' argument ','
        { $$ = [ $2 ] }
    | ',' argument arglist0
        { $$ = [ $2 ].concat( $3 ) }
    ;


// argument: test [comp_for] | test '=' test
argument
    : test
        { $$ = { type: 'arg', actual: $1 } }
    | test comp_for
        { $$ = { type: 'arg', actual: $1, loop: $2 } }
    | test '=' test
        { $$ = { type: 'arg', keyword: $1, actual: $3 } }
    | '**' test
        { $$ = { type: 'arg', keyword: true, actual: $2 } }
    | '*' test
        { $$ = { type: 'arg', unpack: true, actual: $2 } }
    ;

// comp_iter: comp_for | comp_if
comp_iter: comp_for | comp_if ;

// comp_for: 'for' exprlist 'in' or_test [comp_iter]
comp_for
    : 'for' exprlist 'in' or_test
        { $$ = [{ type: 'comp_for', for: $2, in: $4, location: @$ }] }
    | 'for' exprlist 'in' or_test comp_iter
        { $$ = [{ type: 'comp_for', for: $2, in: $4, location: @$ }].concat( $5 ) }
    ;

// comp_if: 'if' test_nocond [comp_iter]
comp_if
    : 'if' test_nocond
        { $$ = [{ type: 'comp_if', test: $2, location: @$ }] }
    | 'if' test_nocond comp_iter
        { $$ = [{ type: 'comp_if', test: $2, location: @$ }].concat( $3 )}
    ;

// yield_expr: 'yield' [yield_arg]
yield_expr
    : 'yield'
        { $$ = { type: 'yield', location: @$ } }
    | 'yield' yield_arg
        { $$ = { type: 'yield', value: $1, location: @$ } }
    ;

// yield_arg: 'from' test | testlist
yield_arg
    : 'from' test
    | testlist
    ;

